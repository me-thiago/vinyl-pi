import { spawn, ChildProcess } from 'child_process';
import { mkdir, stat, access, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
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
  drainActive: boolean;        // Se o drain process está ativo
}

/**
 * RecordingManager - Gerencia gravação FLAC via FFmpeg #4 (V3a)
 *
 * Arquitetura:
 * - FIFO3 sempre precisa de um leitor para não bloquear FFmpeg #1
 * - Quando NÃO está gravando: "drain process" lê e descarta dados
 * - Quando ESTÁ gravando: FFmpeg #4 lê e grava FLAC
 *
 * Lifecycle:
 * 1. startDrain() - Inicia drain process (chamado quando streaming inicia)
 * 2. startRecording() - Para drain, inicia FFmpeg #4
 * 3. stopRecording() - Para FFmpeg #4, reinicia drain
 * 4. stopDrain() - Para drain (chamado quando streaming para)
 *
 * ⚠️ LIFECYCLE NOTE: This service is managed by the application and
 * should be properly destroyed when no longer needed to avoid leaks.
 */
export class RecordingManager extends EventEmitter {
  private config: RecordingConfig;
  private drainProcess: ChildProcess | null = null;
  private ffmpegProcess: ChildProcess | null = null;
  private currentRecordingId: string | null = null;
  private recordingStartTime: Date | null = null;
  private isRecording: boolean = false;
  private isDraining: boolean = false;
  private fileSizeCheckInterval: NodeJS.Timeout | null = null;
  private currentFilePath: string | null = null;

  constructor(config: RecordingConfig) {
    super();
    this.config = {
      ...config,
      compressionLevel: config.compressionLevel || 5,
    };
    logger.info(`RecordingManager initialized with FIFO: ${config.flacFifoPath}`);
  }

  /**
   * Inicia o drain process (lê FIFO3 e descarta)
   *
   * Deve ser chamado quando streaming inicia, para evitar que
   * o FIFO3 bloqueie o FFmpeg #1.
   */
  async startDrain(): Promise<void> {
    if (this.isDraining || this.isRecording) {
      logger.warn('Drain already active or recording in progress');
      return;
    }

    try {
      // Verificar se FIFO existe
      await access(this.config.flacFifoPath);
    } catch {
      logger.warn(`FIFO3 not found at ${this.config.flacFifoPath}, drain not started`);
      return;
    }

    // Usar 'cat FIFO > /dev/null' para drenar dados
    // Alternativa mais eficiente: dd if=FIFO of=/dev/null bs=4k
    this.drainProcess = spawn('dd', [
      `if=${this.config.flacFifoPath}`,
      'of=/dev/null',
      'bs=4k',
    ], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    this.drainProcess.on('error', (err) => {
      logger.error(`Drain process error: ${err.message}`);
      this.isDraining = false;
    });

    this.drainProcess.on('exit', (code, signal) => {
      // Só logar se não foi parada intencional
      if (this.isDraining) {
        logger.info(`Drain process exited (code: ${code}, signal: ${signal})`);
      }
      this.isDraining = false;
      this.drainProcess = null;
    });

    this.isDraining = true;
    logger.info('Drain process started (FIFO3 → /dev/null)');
  }

  /**
   * Para o drain process
   */
  async stopDrain(): Promise<void> {
    if (!this.isDraining || !this.drainProcess) {
      return;
    }

    return new Promise((resolve) => {
      const processRef = this.drainProcess;
      if (!processRef) {
        this.isDraining = false;
        resolve();
        return;
      }

      processRef.once('exit', () => {
        this.isDraining = false;
        this.drainProcess = null;
        logger.info('Drain process stopped');
        resolve();
      });

      processRef.kill('SIGTERM');

      // Timeout: force kill se não parar em 1s
      setTimeout(() => {
        if (processRef && !processRef.killed) {
          processRef.kill('SIGKILL');
        }
        resolve();
      }, 1000);
    });
  }

  /**
   * Inicia uma gravação FLAC
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

    // 1. Parar drain process
    await this.stopDrain();

    // 2. Gerar caminho do arquivo
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const recordingId = crypto.randomUUID();
    const fileName = options.fileName || `rec-${now.toISOString().replace(/[:.]/g, '-')}`;
    const relativePath = join(yearMonth, `${fileName}.flac`);
    const absolutePath = join(this.config.recordingsPath, relativePath);

    // 3. Criar diretório se não existir
    await mkdir(dirname(absolutePath), { recursive: true });

    // 4. Criar registro no banco
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

    // 5. Iniciar FFmpeg #4
    const ffmpegArgs = this.buildFlacFFmpegArgs(absolutePath);
    logger.info(`Starting FFmpeg FLAC: ffmpeg ${ffmpegArgs.join(' ')}`);

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });

    this.setupFFmpegHandlers();

    this.isRecording = true;
    this.currentRecordingId = recordingId;
    this.recordingStartTime = now;
    this.currentFilePath = absolutePath;

    // 6. Iniciar verificação periódica de tamanho do arquivo
    this.startFileSizeMonitor();

    logger.info(`Recording started: ${relativePath} (ID: ${recordingId})`);
    this.emit('recording_started', { recording });

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
   * @returns Recording atualizado com duração e tamanho
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

    // 2. Parar FFmpeg #4
    await this.stopFFmpegProcess();

    // 3. Calcular duração e tamanho
    const durationSeconds = startTime
      ? Math.floor((Date.now() - startTime.getTime()) / 1000)
      : 0;

    let fileSizeBytes = 0;
    try {
      if (filePath) {
        const stats = await stat(filePath);
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

    // 6. Reiniciar drain process
    await this.startDrain();

    logger.info(`Recording stopped: ${recording.filePath} (${durationSeconds}s, ${fileSizeBytes} bytes)`);
    this.emit('recording_stopped', { recording });

    return {
      id: recording.id,
      status: recording.status,
      durationSeconds: recording.durationSeconds || 0,
      fileSizeBytes: recording.fileSizeBytes || 0,
      filePath: recording.filePath,
    };
  }

  /**
   * Retorna o status atual da gravação
   */
  getStatus(): RecordingManagerStatus {
    const status: RecordingManagerStatus = {
      isRecording: this.isRecording,
      drainActive: this.isDraining,
    };

    if (this.isRecording && this.currentRecordingId && this.recordingStartTime) {
      const durationSeconds = Math.floor(
        (Date.now() - this.recordingStartTime.getTime()) / 1000
      );

      status.currentRecording = {
        id: this.currentRecordingId,
        startedAt: this.recordingStartTime,
        durationSeconds,
        fileSizeBytes: 0, // Será atualizado pelo monitor
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

    await this.stopDrain();

    logger.info('RecordingManager destroyed');
  }

  /**
   * Constrói argumentos do FFmpeg #4 para gravação FLAC
   * @private
   */
  private buildFlacFFmpegArgs(outputPath: string): string[] {
    return [
      '-y', // Sobrescrever se existir
      '-loglevel', 'error',

      // Input: PCM do FIFO3
      '-f', 's16le',
      '-ar', this.config.sampleRate.toString(),
      '-ac', this.config.channels.toString(),
      '-i', this.config.flacFifoPath,

      // Output: FLAC
      '-c:a', 'flac',
      '-compression_level', this.config.compressionLevel.toString(),
      outputPath,
    ];
  }

  /**
   * Configura handlers para FFmpeg #4
   * @private
   */
  private setupFFmpegHandlers(): void {
    if (!this.ffmpegProcess) return;

    this.ffmpegProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (output.includes('error') || output.includes('Error')) {
        logger.error(`FFmpeg FLAC ERROR: ${output}`);
      } else {
        logger.debug(`FFmpeg FLAC: ${output}`);
      }
    });

    this.ffmpegProcess.on('exit', async (code, signal) => {
      logger.info(`FFmpeg FLAC exited (code: ${code}, signal: ${signal})`);

      // Se saída inesperada durante gravação, marcar como erro
      if (this.isRecording && code !== 0 && code !== null) {
        logger.error(`FFmpeg FLAC crashed during recording!`);

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

        this.isRecording = false;
        this.currentRecordingId = null;
        this.recordingStartTime = null;
        this.currentFilePath = null;

        // Reiniciar drain para não bloquear FIFO
        await this.startDrain();

        this.emit('recording_error', { error: 'FFmpeg crashed' });
      }

      this.ffmpegProcess = null;
    });

    this.ffmpegProcess.on('error', (err) => {
      logger.error(`FFmpeg FLAC process error: ${err.message}`);
    });
  }

  /**
   * Para o processo FFmpeg #4
   * @private
   */
  private async stopFFmpegProcess(): Promise<void> {
    if (!this.ffmpegProcess) return;

    return new Promise((resolve) => {
      const processRef = this.ffmpegProcess;
      if (!processRef) {
        resolve();
        return;
      }

      processRef.once('exit', () => {
        this.ffmpegProcess = null;
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
   * Inicia monitoramento periódico de tamanho do arquivo
   * @private
   */
  private startFileSizeMonitor(): void {
    this.fileSizeCheckInterval = setInterval(async () => {
      if (!this.currentFilePath || !this.isRecording) return;

      try {
        const stats = await stat(this.currentFilePath);
        const durationSeconds = this.recordingStartTime
          ? Math.floor((Date.now() - this.recordingStartTime.getTime()) / 1000)
          : 0;

        this.emit('recording_progress', {
          recordingId: this.currentRecordingId,
          durationSeconds,
          fileSizeBytes: stats.size,
        });
      } catch {
        // Arquivo pode não existir ainda nos primeiros segundos
      }
    }, 2000); // A cada 2 segundos
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
