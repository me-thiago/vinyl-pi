import { spawn, ChildProcess } from 'child_process';
import { mkdir, stat, access, unlink, createWriteStream } from 'fs';
import { mkdir as mkdirAsync, stat as statAsync } from 'fs/promises';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';
import { WriteStream } from 'fs';
import { createLogger } from '../utils/logger';
import { eventBus } from '../utils/event-bus';
import prisma from '../prisma/client';
import { RecordingStatus } from '@prisma/client';

const logger = createLogger('RecordingManager');

/**
 * Configuração de gravação
 */
export interface RecordingConfig {
  flacFifoPath: string;        // Caminho do FIFO3 (do AudioManager)
  recordingsPath: string;       // Diretório base para gravações
  sampleRate: number;           // Sample rate (48000)
  channels: number;             // Canais (2)
  compressionLevel: number;     // Nível de compressão FLAC (0-12, default 5)
}

/**
 * Opções para iniciar gravação
 */
export interface StartRecordingOptions {
  albumId?: string;            // ID do álbum (opcional)
  sessionId?: string;          // ID da sessão (opcional)
  fileName?: string;           // Nome amigável (default: timestamp)
}

/**
 * Status atual da gravação
 */
export interface RecordingManagerStatus {
  isRecording: boolean;
  currentRecording?: {
    id: string;
    startedAt: Date;
    durationSeconds: number;
    fileSizeBytes: number;
    filePath: string;
  };
  flacProcessActive: boolean;  // Se FFmpeg #4 está rodando
}

/**
 * RecordingManager - Gerencia gravação FLAC via FFmpeg #4 (V3a)
 *
 * Arquitetura Consistente (igual FFmpeg #3):
 * - FFmpeg #4 sempre ligado quando streaming ativo
 * - Lê de FIFO3, escreve FLAC para stdout
 * - Node.js lê stdout e decide: arquivo (quando gravando) ou descarte
 *
 * Lifecycle:
 * 1. startFlacProcess() - Inicia FFmpeg #4 (quando streaming inicia)
 * 2. startRecording() - Começa a escrever stdout para arquivo
 * 3. stopRecording() - Para de escrever, fecha arquivo
 * 4. stopFlacProcess() - Para FFmpeg #4 (quando streaming para)
 *
 * ⚠️ LIFECYCLE NOTE: This service is managed by the application and
 * should be properly destroyed when no longer needed to avoid leaks.
 */
export class RecordingManager extends EventEmitter {
  private config: RecordingConfig;
  private ffmpegProcess: ChildProcess | null = null;
  private outputStream: WriteStream | null = null;
  private currentRecordingId: string | null = null;
  private recordingStartTime: Date | null = null;
  private isRecording: boolean = false;
  private isFlacProcessActive: boolean = false;
  private fileSizeCheckInterval: NodeJS.Timeout | null = null;
  private currentFilePath: string | null = null;
  private bytesWritten: number = 0;

  constructor(config: RecordingConfig) {
    super();
    this.config = {
      ...config,
      compressionLevel: config.compressionLevel || 5,
    };
    logger.info(`RecordingManager initialized with FIFO: ${config.flacFifoPath}`);
  }

  /**
   * Inicia o FFmpeg #4 (FLAC encoder sempre ativo)
   *
   * Deve ser chamado quando streaming inicia.
   * FFmpeg lê do FIFO3 e escreve FLAC para stdout.
   * Node.js processa stdout - descarta ou grava em arquivo.
   *
   * Consistente com FFmpeg #3 (recognition → ringBuffer).
   */
  async startFlacProcess(): Promise<void> {
    if (this.isFlacProcessActive) {
      logger.warn('FLAC process already active');
      return;
    }

    try {
      // Verificar se FIFO existe
      await new Promise<void>((resolve, reject) => {
        access(this.config.flacFifoPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch {
      logger.warn(`FIFO3 not found at ${this.config.flacFifoPath}, FLAC process not started`);
      return;
    }

    // Construir argumentos FFmpeg
    const args = this.buildFlacFFmpegArgs();
    logger.info(`Starting FFmpeg FLAC (always-on): ffmpeg ${args.join(' ')}`);

    // Spawn FFmpeg #4 - stdout é pipe para Node.js
    this.ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],  // stdout=pipe (FLAC), stderr=pipe (logs)
    });

    this.setupFFmpegHandlers();
    this.isFlacProcessActive = true;

    logger.info('FFmpeg #4 FLAC process started (stdout → Node.js)');
  }

  /**
   * Para o FFmpeg #4
   *
   * Deve ser chamado quando streaming para.
   */
  async stopFlacProcess(): Promise<void> {
    if (!this.isFlacProcessActive || !this.ffmpegProcess) {
      return;
    }

    // Se estiver gravando, parar primeiro
    if (this.isRecording) {
      try {
        await this.stopRecording();
      } catch (err) {
        logger.warn(`Error stopping recording during FLAC process stop: ${err}`);
      }
    }

    return new Promise((resolve) => {
      const processRef = this.ffmpegProcess;
      if (!processRef) {
        this.isFlacProcessActive = false;
        resolve();
        return;
      }

      processRef.once('exit', () => {
        this.isFlacProcessActive = false;
        this.ffmpegProcess = null;
        logger.info('FFmpeg #4 FLAC process stopped');
        resolve();
      });

      processRef.kill('SIGTERM');

      // Timeout: force kill se não parar em 2s
      setTimeout(() => {
        if (processRef && !processRef.killed) {
          logger.warn('FFmpeg FLAC did not stop gracefully, sending SIGKILL');
          processRef.kill('SIGKILL');
        }
        resolve();
      }, 2000);
    });
  }

  /**
   * Inicia uma gravação FLAC
   *
   * Abre arquivo e começa a escrever stdout do FFmpeg #4 nele.
   *
   * @param options Opções de gravação
   * @returns Recording criado no banco
   */
  async startRecording(options: StartRecordingOptions = {}): Promise<{
    id: string;
    status: RecordingStatus;
    startedAt: Date;
    filePath: string;
  }> {
    if (this.isRecording) {
      throw new Error('Gravação já em andamento. Pare a gravação atual primeiro.');
    }

    if (!this.isFlacProcessActive || !this.ffmpegProcess) {
      throw new Error('FFmpeg FLAC não está ativo. Streaming precisa estar ligado.');
    }

    // 1. Gerar caminho do arquivo
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recordingId = crypto.randomUUID();
    const fileName = options.fileName || `rec-${now.toISOString().replace(/[:.]/g, '-')}`;
    const relativePath = join(yearMonth, `${fileName}.flac`);
    const absolutePath = join(this.config.recordingsPath, relativePath);

    // 2. Criar diretório se não existir
    await mkdirAsync(dirname(absolutePath), { recursive: true });

    // 3. Criar registro no banco
    const recording = await prisma.recording.create({
      data: {
        id: recordingId,
        albumId: options.albumId || null,
        sessionId: options.sessionId || null,
        filePath: relativePath,
        fileName: fileName,
        format: 'flac',
        sampleRate: this.config.sampleRate,
        bitDepth: 16,
        channels: this.config.channels,
        status: 'recording',
        startedAt: now,
      },
    });

    // 4. Abrir arquivo para escrita
    this.outputStream = createWriteStream(absolutePath);
    this.bytesWritten = 0;

    this.outputStream.on('error', (err) => {
      logger.error(`Output stream error: ${err.message}`);
      this.emit('recording_error', { error: err.message });
    });

    // 5. Atualizar estado
    this.isRecording = true;
    this.currentRecordingId = recordingId;
    this.recordingStartTime = now;
    this.currentFilePath = absolutePath;

    // 6. Iniciar verificação periódica de tamanho
    this.startFileSizeMonitor();

    logger.info(`Recording started: ${relativePath} (ID: ${recordingId})`);
    this.emit('recording_started', { recording });
    
    // Emit EventBus event for cross-component communication
    await eventBus.publish('recording.started', {
      recording: {
        id: recording.id,
        albumId: recording.albumId,
        filePath: recording.filePath,
        startedAt: recording.startedAt.toISOString(),
      },
    });

    return {
      id: recording.id,
      status: recording.status,
      startedAt: recording.startedAt,
      filePath: recording.filePath,
    };
  }

  /**
   * Para a gravação atual
   *
   * Fecha arquivo e atualiza banco com duração e tamanho.
   *
   * @returns Recording atualizado
   */
  async stopRecording(): Promise<{
    id: string;
    status: RecordingStatus;
    durationSeconds: number;
    fileSizeBytes: number;
    filePath: string;
  }> {
    if (!this.isRecording || !this.currentRecordingId) {
      throw new Error('Nenhuma gravação em andamento');
    }

    const recordingId = this.currentRecordingId;
    const startTime = this.recordingStartTime;
    const filePath = this.currentFilePath;

    // 1. Parar verificação de tamanho
    this.stopFileSizeMonitor();

    // 2. Fechar stream de escrita
    await this.closeOutputStream();

    // 3. Calcular duração e tamanho
    const durationSeconds = startTime
      ? Math.floor((Date.now() - startTime.getTime()) / 1000)
      : 0;

    let fileSizeBytes = this.bytesWritten;
    try {
      if (filePath) {
        const stats = await statAsync(filePath);
        fileSizeBytes = stats.size;
      }
    } catch (err) {
      logger.warn(`Could not get file size for ${filePath}: ${err}`);
    }

    // 4. Atualizar registro no banco
    const recording = await prisma.recording.update({
      where: { id: recordingId },
      data: {
        status: 'completed',
        durationSeconds,
        fileSizeBytes,
        completedAt: new Date(),
      },
    });

    // 5. Reset estado
    this.isRecording = false;
    this.currentRecordingId = null;
    this.recordingStartTime = null;
    this.currentFilePath = null;
    this.bytesWritten = 0;

    logger.info(`Recording stopped: ${recording.filePath} (${durationSeconds}s, ${fileSizeBytes} bytes)`);
    this.emit('recording_stopped', { recording });
    
    // Emit EventBus event for cross-component communication
    await eventBus.publish('recording.stopped', {
      recording: {
        id: recording.id,
        albumId: recording.albumId,
        filePath: recording.filePath,
        durationSeconds: recording.durationSeconds || 0,
        fileSizeBytes: recording.fileSizeBytes || 0,
        completedAt: recording.completedAt?.toISOString(),
      },
    });

    return {
      id: recording.id,
      status: recording.status,
      durationSeconds: recording.durationSeconds || 0,
      fileSizeBytes: recording.fileSizeBytes || 0,
      filePath: recording.filePath,
    };
  }

  /**
   * Retorna o status atual
   */
  getStatus(): RecordingManagerStatus {
    const status: RecordingManagerStatus = {
      isRecording: this.isRecording,
      flacProcessActive: this.isFlacProcessActive,
    };

    if (this.isRecording && this.currentRecordingId && this.recordingStartTime) {
      const durationSeconds = Math.floor(
        (Date.now() - this.recordingStartTime.getTime()) / 1000
      );

      status.currentRecording = {
        id: this.currentRecordingId,
        startedAt: this.recordingStartTime,
        durationSeconds,
        fileSizeBytes: this.bytesWritten,
        filePath: this.currentFilePath || '',
      };
    }

    return status;
  }

  /**
   * Verifica se está gravando
   */
  getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Cleanup - para todos os processos
   */
  async destroy(): Promise<void> {
    logger.info('RecordingManager destroying...');

    this.stopFileSizeMonitor();

    if (this.isRecording) {
      try {
        await this.stopRecording();
      } catch (err) {
        logger.error(`Error stopping recording during destroy: ${err}`);
      }
    }

    await this.stopFlacProcess();

    logger.info('RecordingManager destroyed');
  }

  // ==================== MÉTODOS LEGADO (para compatibilidade) ====================

  /**
   * @deprecated Use startFlacProcess() instead
   */
  async startDrain(): Promise<void> {
    return this.startFlacProcess();
  }

  /**
   * @deprecated Use stopFlacProcess() instead
   */
  async stopDrain(): Promise<void> {
    return this.stopFlacProcess();
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Constrói argumentos do FFmpeg #4 para FLAC
   *
   * Diferente da versão anterior, agora escreve para stdout (pipe:1)
   * em vez de arquivo direto. Node.js decide o destino.
   *
   * @private
   */
  private buildFlacFFmpegArgs(): string[] {
    return [
      '-y',
      '-loglevel', 'error',

      // Input: PCM do FIFO3
      '-f', 's16le',
      '-ar', this.config.sampleRate.toString(),
      '-ac', this.config.channels.toString(),
      '-i', this.config.flacFifoPath,

      // Output: FLAC para stdout
      '-c:a', 'flac',
      '-compression_level', this.config.compressionLevel.toString(),
      '-f', 'flac',
      'pipe:1',  // stdout - Node.js lê e decide destino
    ];
  }

  /**
   * Configura handlers para FFmpeg #4
   *
   * O stdout é lido continuamente. Quando gravando, escreve em arquivo.
   * Quando não gravando, descarta (Node.js não faz nada com os dados).
   *
   * @private
   */
  private setupFFmpegHandlers(): void {
    if (!this.ffmpegProcess) return;

    // Handler principal: stdout com dados FLAC
    this.ffmpegProcess.stdout?.on('data', (data: Buffer) => {
      if (this.isRecording && this.outputStream && !this.outputStream.destroyed) {
        this.outputStream.write(data);
        this.bytesWritten += data.length;
      }
      // Quando não gravando: dados são descartados implicitamente
    });

    // Monitorar stderr para erros
    this.ffmpegProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        logger.error(`FFmpeg FLAC ERROR: ${output}`);
      } else {
        logger.debug(`FFmpeg FLAC: ${output}`);
      }
    });

    // Handler de saída
    this.ffmpegProcess.on('exit', async (code, signal) => {
      logger.info(`FFmpeg FLAC exited (code: ${code}, signal: ${signal})`);

      // Se saída inesperada durante gravação, marcar como erro
      if (this.isRecording && code !== 0 && code !== null) {
        logger.error(`FFmpeg FLAC crashed during recording!`);

        await this.handleRecordingError('FFmpeg crashed');
      }

      this.isFlacProcessActive = false;
      this.ffmpegProcess = null;
    });

    // Handler de erro
    this.ffmpegProcess.on('error', (err) => {
      logger.error(`FFmpeg FLAC process error: ${err.message}`);
    });
  }

  /**
   * Trata erro durante gravação
   * @private
   */
  private async handleRecordingError(errorMessage: string): Promise<void> {
    if (this.currentRecordingId) {
      try {
        await prisma.recording.update({
          where: { id: this.currentRecordingId },
          data: { status: 'error' },
        });
      } catch (err) {
        logger.error(`Failed to update recording status: ${err}`);
      }
    }

    await this.closeOutputStream();

    this.isRecording = false;
    this.currentRecordingId = null;
    this.recordingStartTime = null;
    this.currentFilePath = null;
    this.bytesWritten = 0;

    this.emit('recording_error', { error: errorMessage });
  }

  /**
   * Fecha o stream de saída
   * @private
   */
  private async closeOutputStream(): Promise<void> {
    if (!this.outputStream) return;

    return new Promise((resolve) => {
      if (!this.outputStream) {
        resolve();
        return;
      }

      this.outputStream.end(() => {
        this.outputStream = null;
        resolve();
      });

      // Timeout: force close
      setTimeout(() => {
        if (this.outputStream) {
          this.outputStream.destroy();
          this.outputStream = null;
        }
        resolve();
      }, 1000);
    });
  }

  /**
   * Inicia monitoramento periódico de tamanho
   * @private
   */
  private startFileSizeMonitor(): void {
    this.fileSizeCheckInterval = setInterval(() => {
      if (!this.isRecording) return;

      const durationSeconds = this.recordingStartTime
        ? Math.floor((Date.now() - this.recordingStartTime.getTime()) / 1000)
        : 0;

      this.emit('recording_progress', {
        recordingId: this.currentRecordingId,
        durationSeconds,
        fileSizeBytes: this.bytesWritten,
      });
    }, 2000);
  }

  /**
   * Para monitoramento de tamanho
   * @private
   */
  private stopFileSizeMonitor(): void {
    if (this.fileSizeCheckInterval) {
      clearInterval(this.fileSizeCheckInterval);
      this.fileSizeCheckInterval = null;
    }
  }
}

/**
 * Configuração padrão para RecordingManager
 */
export const DEFAULT_RECORDING_CONFIG: Omit<RecordingConfig, 'flacFifoPath'> = {
  recordingsPath: './data/recordings',
  sampleRate: 48000,
  channels: 2,
  compressionLevel: 5,
};
