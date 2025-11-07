import { spawn, exec, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { unlink, access } from 'fs';
import { promisify } from 'util';
import winston from 'winston';

const execAsync = promisify(exec);
const unlinkAsync = promisify(unlink);
const accessAsync = promisify(access);

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/audio-manager.log' })
  ]
});

/**
 * Configuração de captura de áudio
 */
export interface AudioConfig {
  device: string;          // Device ALSA (ex: "plughw:1,0")
  sampleRate: number;      // Sample rate em Hz (ex: 48000)
  channels: number;        // Número de canais (1=mono, 2=stereo)
  bitDepth: number;        // Bit depth (8, 16, 24, 32)
  bufferSize: number;      // Buffer size em samples (512-2048)
}

/**
 * Configuração de streaming para Icecast2
 */
export interface StreamingConfig {
  icecastHost: string;     // Host do Icecast2 (ex: "localhost")
  icecastPort: number;     // Porta do Icecast2 (ex: 8000)
  icecastPassword: string; // Password do source
  mountPoint: string;      // Mount point (ex: "/stream")
  bitrate: number;         // Bitrate MP3 em kbps (ex: 320)
  fallbackSilence: boolean; // Usar fallback de silêncio quando input falha
}

/**
 * Status do streaming
 */
export interface StreamingStatus {
  active: boolean;         // Se streaming está ativo
  listeners?: number;      // Número de listeners (se disponível)
  bitrate: number;         // Bitrate configurado
  mountPoint: string;      // Mount point
  error?: string;          // Mensagem de erro (se houver)
}

/**
 * Status da captura de áudio
 */
export interface AudioCaptureStatus {
  isCapturing: boolean;    // Se está capturando atualmente
  device: string;          // Device ALSA em uso
  levelDb?: number;        // Nível de áudio em dB (se disponível)
  error?: string;          // Mensagem de erro (se houver)
}

/**
 * Gerenciador de captura de áudio via ALSA/FFmpeg
 *
 * Responsável por capturar áudio do dispositivo ALSA configurado
 * usando FFmpeg como child process, com detecção de erros e logging.
 */
export class AudioManager extends EventEmitter {
  private ffmpegProcess: ChildProcess | null = null;
  private ffmpegMp3Process: ChildProcess | null = null; // Segundo FFmpeg para MP3
  private config: AudioConfig;
  private streamingConfig?: StreamingConfig;
  private isCapturing: boolean = false;
  private isStreaming: boolean = false;
  private currentError?: string;
  private levelDb?: number;
  private fifoPath: string = '/tmp/vinyl-audio.fifo';

  /**
   * Cria uma instância do AudioManager
   * @param config Configuração de captura de áudio
   */
  constructor(config?: Partial<AudioConfig>) {
    super();

    // Configuração padrão com overrides
    this.config = {
      device: config?.device || 'plughw:1,0',
      sampleRate: config?.sampleRate || 48000,
      channels: config?.channels || 2,
      bitDepth: config?.bitDepth || 16,
      bufferSize: config?.bufferSize || 1024
    };

    // Validar buffer size
    if (this.config.bufferSize < 512 || this.config.bufferSize > 2048) {
      throw new Error(`Buffer size must be between 512 and 2048 samples, got ${this.config.bufferSize}`);
    }

    logger.info(`AudioManager initialized with device: ${this.config.device}, ` +
                `sampleRate: ${this.config.sampleRate}Hz, ` +
                `channels: ${this.config.channels}, ` +
                `bufferSize: ${this.config.bufferSize}`);
  }

  /**
   * Inicia a captura de áudio
   * @returns Promise que resolve quando captura iniciar
   */
  async start(): Promise<void> {
    if (this.isCapturing) {
      logger.warn('Audio capture already running');
      return;
    }

    try {
      // Validar device ALSA antes de iniciar
      await this.validateDevice();

      // Construir comando FFmpeg
      const args = this.buildFFmpegArgs();

      logger.info(`Starting FFmpeg with args: ${args.join(' ')}`);

      // Spawn processo FFmpeg
      // NOTA: stdout é 'ignore' por enquanto - V1.5 conectará ao Icecast
      this.ffmpegProcess = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe']  // stdin: ignore, stdout: ignore, stderr: pipe
      });

      // Configurar handlers
      this.setupProcessHandlers();

      this.isCapturing = true;
      this.currentError = undefined;

      logger.info('Audio capture started successfully');
      this.emit('started', { device: this.config.device });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.currentError = errorMsg;
      logger.error(`Failed to start audio capture: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Para a captura de áudio
   *
   * Implementa cleanup atômico para evitar race conditions entre SIGTERM/SIGKILL paths.
   * O cleanup é idempotente e garante que todas as flags de estado sejam resetadas
   * exatamente uma vez, mesmo se o evento 'exit' e o timeout forçado ocorrerem
   * simultaneamente.
   *
   * @returns Promise que resolve quando captura parar
   */
  async stop(): Promise<void> {
    if (!this.isCapturing || !this.ffmpegProcess) {
      logger.warn('Audio capture not running');
      return;
    }

    return new Promise((resolve) => {
      if (!this.ffmpegProcess) {
        this.resetState();
        resolve();
        return;
      }

      let cleanupCalled = false;

      const cleanup = () => {
        if (cleanupCalled) return;  // ✅ Idempotente - evita múltiplas execuções
        cleanupCalled = true;

        this.resetState();  // ✅ Reset atômico de TODAS as flags
        logger.info('Audio capture stopped');
        this.emit('stopped');
        resolve();
      };

      // Event handler: chamado quando processo terminar (SIGTERM ou SIGKILL)
      this.ffmpegProcess.once('exit', cleanup);

      // Enviar SIGTERM para parar graciosamente
      this.ffmpegProcess.kill('SIGTERM');

      // Timeout: SIGKILL se processo não terminar em 5s
      setTimeout(() => {
        if (!this.ffmpegProcess || cleanupCalled) return;

        if (!this.ffmpegProcess.killed) {
          logger.warn('FFmpeg did not stop gracefully, sending SIGKILL');
          this.ffmpegProcess.kill('SIGKILL');
        }

        // Aguardar mais 1s para evento 'exit' após SIGKILL
        // Se evento não ocorrer, forçar cleanup (mas é idempotente)
        setTimeout(() => {
          cleanup();  // ✅ Safe: idempotente, não duplica se já foi chamado
        }, 1000);
      }, 5000);
    });
  }

  /**
   * Reseta atomicamente o estado interno do AudioManager
   *
   * Este método centraliza toda a lógica de reset de estado para garantir
   * consistência. É chamado por todos os exit paths (stop, handlers, error recovery).
   *
   * CRÍTICO: Todas as flags devem ser atualizadas juntas para evitar estado inconsistente
   * onde isStreaming=true mas ffmpegProcess=null.
   *
   * @private
   */
  private resetState(): void {
    this.isCapturing = false;
    this.isStreaming = false;
    this.ffmpegProcess = null;
    this.ffmpegMp3Process = null;
    this.streamingConfig = undefined;
    this.currentError = undefined;

    // Cleanup FIFO se existir
    this.cleanupFifo().catch(err => {
      logger.warn(`Failed to cleanup FIFO during reset: ${err}`);
    });
  }

  /**
   * Reinicia a captura de áudio
   * @returns Promise que resolve quando captura reiniciar
   */
  async restart(): Promise<void> {
    logger.info('Restarting audio capture');
    await this.stop();

    // Aguardar um pouco antes de reiniciar
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.start();
  }

  /**
   * Retorna o status atual da captura
   * @returns Status da captura de áudio
   */
  getStatus(): AudioCaptureStatus {
    return {
      isCapturing: this.isCapturing,
      device: this.config.device,
      levelDb: this.levelDb,
      error: this.currentError
    };
  }

  /**
   * Inicia streaming dual: Raw PCM para frontend + MP3 para Icecast2
   *
   * Arquitetura:
   * ALSA → FFmpeg #1 (principal) → stdout (Raw PCM) → Express /stream.wav
   *                               → FIFO (Raw PCM) → FFmpeg #2 → MP3 → Icecast2
   *
   * @param config Configuração de streaming
   * @returns Promise que resolve quando streaming iniciar
   */
  async startStreaming(config: StreamingConfig): Promise<void> {
    // ✅ Validação proativa: detectar estado inconsistente
    if (this.isStreaming) {
      const processExists = this.ffmpegProcess && !this.ffmpegProcess.killed;

      if (!processExists) {
        logger.warn('Detected inconsistent state: isStreaming=true but no process. Auto-recovering...');
        this.resetState();
      } else {
        logger.warn('Streaming already active');
        return;
      }
    }

    try {
      // Validar device ALSA antes de iniciar
      await this.validateDevice();

      // Armazenar config de streaming
      this.streamingConfig = config;

      // Criar FIFO para comunicação entre processos FFmpeg
      await this.createFifo();

      // Construir comandos FFmpeg
      const mainArgs = this.buildStreamingFFmpegArgs(config);
      const mp3Args = this.buildMp3FFmpegArgs(config);

      logger.info(`Starting main FFmpeg with args: ${mainArgs.join(' ')}`);
      logger.info(`Starting MP3 FFmpeg with args: ${mp3Args.join(' ')}`);

      // Iniciar segundo FFmpeg PRIMEIRO (leitor do FIFO)
      // IMPORTANTE: Leitor deve estar esperando antes do writer escrever no FIFO
      this.ffmpegMp3Process = spawn('ffmpeg', mp3Args, {
        stdio: ['ignore', 'ignore', 'pipe']  // stderr para logs
      });

      // Configurar handlers para processo MP3
      this.setupMp3ProcessHandlers();

      // Aguardar 100ms para garantir que processo MP3 abriu o FIFO
      await new Promise(resolve => setTimeout(resolve, 100));

      // Iniciar FFmpeg principal (ALSA → stdout + FIFO)
      this.ffmpegProcess = spawn('ffmpeg', mainArgs, {
        stdio: ['ignore', 'pipe', 'pipe']  // stdout=pipe (Raw PCM), stderr=pipe (logs)
      });

      // Configurar handlers para processo principal
      this.setupProcessHandlers();

      this.isCapturing = true;
      this.isStreaming = true;
      this.currentError = undefined;

      logger.info(`Dual streaming started: PCM→Express + MP3→Icecast2 (${config.icecastHost}:${config.icecastPort}${config.mountPoint})`);
      this.emit('streaming_started', {
        host: config.icecastHost,
        port: config.icecastPort,
        mountPoint: config.mountPoint,
        bitrate: config.bitrate
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.currentError = errorMsg;
      logger.error(`Failed to start streaming: ${errorMsg}`);

      // Cleanup em caso de erro
      await this.cleanupFifo();

      throw error;
    }
  }

  /**
   * Para o streaming (ambos processos FFmpeg)
   * @returns Promise que resolve quando streaming parar
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      logger.warn('Streaming not active');
      return;
    }

    // Parar processo principal
    await this.stop();

    // Parar processo MP3
    if (this.ffmpegMp3Process && !this.ffmpegMp3Process.killed) {
      logger.info('Stopping MP3 FFmpeg process');
      this.ffmpegMp3Process.kill('SIGTERM');

      // Aguardar processo terminar
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.ffmpegMp3Process && !this.ffmpegMp3Process.killed) {
            logger.warn('MP3 FFmpeg did not stop gracefully, sending SIGKILL');
            this.ffmpegMp3Process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.ffmpegMp3Process?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    // Limpar FIFO
    await this.cleanupFifo();

    this.isStreaming = false;
    this.streamingConfig = undefined;
    this.ffmpegMp3Process = null;

    logger.info('Streaming stopped (both processes)');
    this.emit('streaming_stopped');
  }

  /**
   * Retorna o status atual do streaming
   * @returns Status do streaming
   */
  getStreamingStatus(): StreamingStatus {
    const baseStatus: StreamingStatus = {
      active: this.isStreaming,
      bitrate: this.streamingConfig?.bitrate || 0,
      mountPoint: this.streamingConfig?.mountPoint || '',
      listeners: undefined, // TODO: Implementar query ao Icecast2 stats
      error: this.currentError
    };

    return baseStatus;
  }

  /**
   * Retorna o stream WAV (stdout do FFmpeg)
   *
   * Usado pelo endpoint /stream.wav para servir áudio PCM de baixa latência.
   * Valida que o processo está rodando e o stdout está disponível.
   *
   * @returns ReadableStream do WAV ou null se não disponível
   */
  getWavStream(): NodeJS.ReadableStream | null {
    if (!this.isStreaming || !this.ffmpegProcess) {
      logger.warn('Cannot get WAV stream: streaming not active');
      return null;
    }

    if (!this.ffmpegProcess.stdout) {
      logger.error('Cannot get WAV stream: stdout not available');
      return null;
    }

    return this.ffmpegProcess.stdout;
  }

  /**
   * Cria Named Pipe (FIFO) para compartilhar áudio entre processos
   * @private
   */
  private async createFifo(): Promise<void> {
    try {
      // Verificar se FIFO já existe
      await accessAsync(this.fifoPath);
      // Existe, remover primeiro
      await unlinkAsync(this.fifoPath);
      logger.info(`Removed existing FIFO at ${this.fifoPath}`);
    } catch (err) {
      // Não existe, OK
    }

    try {
      // Criar FIFO usando comando mkfifo do sistema
      await execAsync(`mkfifo ${this.fifoPath}`);
      // Ajustar permissões
      await execAsync(`chmod 666 ${this.fifoPath}`);
      logger.info(`Created FIFO at ${this.fifoPath}`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create FIFO: ${errorMsg}`);
      throw new Error(`Failed to create FIFO: ${errorMsg}`);
    }
  }

  /**
   * Remove Named Pipe (FIFO)
   * @private
   */
  private async cleanupFifo(): Promise<void> {
    try {
      await unlinkAsync(this.fifoPath);
      logger.info(`Cleaned up FIFO at ${this.fifoPath}`);
    } catch (err) {
      // Ignorar erro se não existir
      logger.warn(`FIFO cleanup warning (may not exist): ${err}`);
    }
  }

  /**
   * Valida se o device ALSA está disponível
   * @private
   */
  private async validateDevice(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Usar arecord para verificar se device existe
      const arecord = spawn('arecord', ['-l']);
      let output = '';

      arecord.stdout.on('data', (data) => {
        output += data.toString();
      });

      arecord.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Failed to validate ALSA device: arecord exited with code ${code}`));
          return;
        }

        // Verificar se device está listado
        // Device plughw:1,0 corresponde a card 1, device 0
        const deviceMatch = this.config.device.match(/plughw:(\d+),(\d+)/);
        if (deviceMatch) {
          const cardNum = deviceMatch[1];
          const deviceRegex = new RegExp(`card ${cardNum}:`);

          if (!deviceRegex.test(output)) {
            reject(new Error(`ALSA device ${this.config.device} not found. Available devices:\n${output}`));
            return;
          }
        }

        logger.info(`ALSA device ${this.config.device} validated successfully`);
        resolve();
      });

      arecord.on('error', (err) => {
        reject(new Error(`Failed to run arecord: ${err.message}`));
      });
    });
  }

  /**
   * Constrói argumentos para o comando FFmpeg
   * @private
   */
  private buildFFmpegArgs(): string[] {
    return [
      '-f', 'alsa',
      '-i', this.config.device,
      '-ar', this.config.sampleRate.toString(),
      '-ac', this.config.channels.toString(),
      '-f', 's16le',
      '-bufsize', this.config.bufferSize.toString(),
      '-' // Output para stdout
    ];
  }

  /**
   * Constrói argumentos para o comando FFmpeg principal (ALSA → stdout + FIFO)
   *
   * Usa -map para duplicar output:
   * 1. Raw PCM → stdout (pipe:1) - baixa latência para Express /stream.wav
   * 2. Raw PCM → FIFO - para segundo FFmpeg processar MP3 → Icecast2
   *
   * @private
   */
  private buildStreamingFFmpegArgs(streamConfig: StreamingConfig): string[] {
    const args: string[] = [];

    // Sobrescrever arquivos automaticamente sem perguntar
    args.push('-y');

    // Log apenas erros (reduzir tamanho de logs)
    args.push('-loglevel', 'error');

    // Input ALSA principal
    args.push('-f', 'alsa');
    args.push('-i', this.config.device);
    args.push('-ar', this.config.sampleRate.toString());
    args.push('-ac', this.config.channels.toString());

    // Output 1: Raw PCM para stdout (pipe:1)
    // Frontend constrói AudioBuffer manualmente
    args.push('-map', '0:a');
    args.push('-c:a', 'pcm_s16le');
    args.push('-f', 's16le');
    args.push('pipe:1');

    // Output 2: Raw PCM para FIFO
    // Segundo FFmpeg lerá daqui e enviará MP3 para Icecast2
    args.push('-map', '0:a');
    args.push('-c:a', 'pcm_s16le');
    args.push('-f', 's16le');
    args.push(this.fifoPath);

    return args;
  }

  /**
   * Constrói argumentos para segundo FFmpeg (FIFO → MP3 → Icecast2)
   * @private
   */
  private buildMp3FFmpegArgs(streamConfig: StreamingConfig): string[] {
    const args: string[] = [];

    // Sobrescrever arquivos automaticamente sem perguntar
    args.push('-y');

    // Log apenas erros (reduzir tamanho de logs)
    args.push('-loglevel', 'error');

    // Input: FIFO com raw PCM
    args.push('-f', 's16le');
    args.push('-ar', this.config.sampleRate.toString());
    args.push('-ac', this.config.channels.toString());
    args.push('-i', this.fifoPath);

    // Output: MP3 para Icecast2 usando libmp3lame
    args.push('-c:a', 'libmp3lame');
    args.push('-b:a', `${streamConfig.bitrate}k`);
    args.push('-f', 'mp3');
    args.push('-content_type', 'audio/mpeg');

    // URL Icecast2
    const icecastUrl = `icecast://source:${streamConfig.icecastPassword}@${streamConfig.icecastHost}:${streamConfig.icecastPort}${streamConfig.mountPoint}`;
    args.push(icecastUrl);

    return args;
  }

  /**
   * Configura handlers para o processo FFmpeg MP3 (FIFO → Icecast2)
   * @private
   */
  private setupMp3ProcessHandlers(): void {
    if (!this.ffmpegMp3Process) return;

    // Monitorar stderr para logs
    this.ffmpegMp3Process.stderr?.on('data', (data) => {
      const output = data.toString();
      logger.info(`FFmpeg MP3 stderr: ${output}`);

      // Detectar erros
      if (output.includes('error') || output.includes('Error')) {
        logger.error(`FFmpeg MP3 ERROR: ${output}`);
      }
    });

    // Handler de saída
    this.ffmpegMp3Process.on('exit', (code, signal) => {
      logger.info(`FFmpeg MP3 process exited with code ${code}, signal ${signal}`);

      // Se saída inesperada (não controlada), logar
      if (code !== 0 && code !== null && this.isStreaming) {
        logger.error(`FFmpeg MP3 exited unexpectedly with code ${code}`);
      }
    });

    // Handler de erro
    this.ffmpegMp3Process.on('error', (err) => {
      logger.error(`FFmpeg MP3 process error: ${err.message}`);
    });
  }

  /**
   * Configura handlers para o processo FFmpeg principal (ALSA → stdout + FIFO)
   *
   * Os handlers garantem cleanup robusto usando resetState() diretamente,
   * sem dependência de timeouts. Isso evita race conditions e garante que
   * o estado seja sempre consistente com a realidade do processo.
   *
   * @private
   */
  private setupProcessHandlers(): void {
    if (!this.ffmpegProcess) return;

    // Monitorar stderr para erros e metadata
    this.ffmpegProcess.stderr?.on('data', (data) => {
      const output = data.toString();

      // Log COMPLETO do stderr para debug (verbose mode)
      logger.info(`FFmpeg stderr: ${output}`);

      // Detectar erros de dispositivo
      if (this.detectDeviceError(output)) {
        this.handleDeviceDisconnected(output);
      }

      // Extrair nível de áudio se disponível
      this.extractAudioLevel(output);

      // Log erros específicos
      if (output.includes('error') || output.includes('Error')) {
        logger.error(`FFmpeg ERROR detected: ${output}`);
      }
    });

    // Handler de saída do processo
    // NOTA: Este handler é registrado com .on(), mas o método stop() usa .once()
    // para registrar seu próprio cleanup handler. Ambos podem coexistir.
    // Este handler permanente é para detectar crashes inesperados (fora de stop()).
    this.ffmpegProcess.on('exit', (code, signal) => {
      // Nota: NÃO resetamos estado aqui se stop() foi chamado
      // O stop() usa .once() e gerencia o cleanup via seu próprio handler
      // Este handler só atua para crashes inesperados quando flags ainda estão true

      // Se código é null/0/undefined E signal é SIGTERM/SIGKILL/undefined, provavelmente é stop() controlado
      // (undefined pode ocorrer em testes quando handler é chamado manualmente)
      const isControlledShutdown =
        (code === null || code === 0 || code === undefined) &&
        (!signal || signal === 'SIGTERM' || signal === 'SIGKILL');

      // Se flags ainda estão true mas processo morreu, pode ser crash inesperado
      // Mas se isControlledShutdown, deixamos o stop() handler fazer o cleanup
      if ((this.isCapturing || this.isStreaming) && !isControlledShutdown) {
        // Processo morreu inesperadamente (crash, erro, etc.)
        const wasStreaming = this.isStreaming;
        this.resetState();

        if (code !== 0 && code !== null && code !== undefined) {
          const errorMsg = `FFmpeg exited unexpectedly with code ${code}`;
          this.currentError = errorMsg;
          logger.error(errorMsg);
          this.emit('error', { code, message: errorMsg });
        } else if (signal && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
          logger.warn(`FFmpeg terminated unexpectedly by signal ${signal}`);
        }

        // Emitir evento de parada se estava streaming
        if (wasStreaming) {
          this.emit('streaming_stopped');
        }
      }
    });

    // Handler de erro do processo
    this.ffmpegProcess.on('error', (err) => {
      // Erro crítico do processo - resetar estado imediatamente
      this.resetState();
      this.currentError = err.message;
      logger.error(`FFmpeg process error: ${err.message}`);
      this.emit('error', { message: err.message });
    });
  }

  /**
   * Detecta erros relacionados ao dispositivo ALSA
   * @private
   */
  private detectDeviceError(output: string): boolean {
    const deviceErrors = [
      'No such file or directory',
      'Device or resource busy',
      'No such device',
      'Cannot open audio device'
    ];

    return deviceErrors.some(error => output.includes(error));
  }

  /**
   * Trata desconexão do dispositivo
   * @private
   */
  private handleDeviceDisconnected(output: string): void {
    const errorMsg = `Device disconnected: ${output.trim()}`;
    this.currentError = errorMsg;
    logger.error(errorMsg);

    this.emit('device_disconnected', {
      device: this.config.device,
      error: errorMsg
    });

    // Parar captura
    this.stop().catch(err => {
      logger.error(`Failed to stop after device disconnect: ${err.message}`);
    });
  }

  /**
   * Extrai nível de áudio do output do FFmpeg
   * @private
   */
  private extractAudioLevel(output: string): void {
    // FFmpeg pode emitir metadata de volume se configurado com -af volumedetect
    // Por enquanto, apenas preparar a interface para futuro enhancement

    // Exemplo de parsing futuro:
    // const levelMatch = output.match(/mean_volume: ([-\d.]+) dB/);
    // if (levelMatch) {
    //   this.levelDb = parseFloat(levelMatch[1]);
    //   this.emit('audio_level', { levelDb: this.levelDb });
    // }
  }

  /**
   * Cleanup quando objeto é destruído
   */
  async cleanup(): Promise<void> {
    if (this.isCapturing) {
      await this.stop();
    }
  }
}

/**
 * Configuração padrão de áudio
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  device: 'plughw:1,0',
  sampleRate: 48000,
  channels: 2,
  bitDepth: 16,
  bufferSize: 1024
};
