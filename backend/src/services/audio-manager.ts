import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { createLogger } from '../utils/logger';
import { getListenerCount } from './icecast-stats';
import {
  AudioRingBuffer,
  DEFAULT_RING_BUFFER_CONFIG,
  RingBufferStats,
} from '../utils/ring-buffer';
import { FFmpegProcessManager } from '../utils/ffmpeg-process';
import { FifoManager } from '../utils/fifo-manager';
import {
  FFmpegArgsBuilder,
  AudioConfig as FFmpegAudioConfig,
  StreamingConfig as FFmpegStreamingConfig,
  FifoPaths,
} from '../utils/ffmpeg-args';

const logger = createLogger('AudioManager');

/**
 * Configuracao de captura de audio
 */
export interface AudioConfig {
  device: string;          // Device ALSA (ex: "plughw:1,0")
  sampleRate: number;      // Sample rate em Hz (ex: 48000)
  channels: number;        // Numero de canais (1=mono, 2=stereo)
  bitDepth: number;        // Bit depth (8, 16, 24, 32)
  bufferSize: number;      // Buffer size em samples (512-2048)
}

/**
 * Configuracao de streaming para Icecast2
 */
export interface StreamingConfig {
  icecastHost: string;     // Host do Icecast2 (ex: "localhost")
  icecastPort: number;     // Porta do Icecast2 (ex: 8000)
  icecastPassword: string; // Password do source
  mountPoint: string;      // Mount point (ex: "/stream")
  bitrate: number;         // Bitrate MP3 em kbps (ex: 320)
  fallbackSilence: boolean; // Usar fallback de silencio quando input falha
}

/**
 * Status do streaming
 */
export interface StreamingStatus {
  active: boolean;         // Se streaming esta ativo
  listeners?: number;      // Numero de listeners (se disponivel)
  bitrate: number;         // Bitrate configurado
  mountPoint: string;      // Mount point
  error?: string;          // Mensagem de erro (se houver)
}

/**
 * Status da captura de audio
 */
export interface AudioCaptureStatus {
  isCapturing: boolean;    // Se esta capturando atualmente
  device: string;          // Device ALSA em uso
  levelDb?: number;        // Nivel de audio em dB (se disponivel)
  error?: string;          // Mensagem de erro (se houver)
}

/**
 * Gerenciador de captura de audio via ALSA/FFmpeg
 *
 * Responsavel por capturar audio do dispositivo ALSA configurado
 * usando FFmpeg como child process, com deteccao de erros e logging.
 *
 * Arquitetura (Quad-Path):
 * - FFmpeg #1 (Main): ALSA -> stdout (PCM) + 3 FIFOs
 * - FFmpeg #2 (MP3): FIFO -> MP3 -> Icecast2
 * - FFmpeg #3 (Recognition): FIFO -> stdout -> Ring Buffer
 * - FFmpeg #4 (FLAC): Gerenciado por RecordingManager
 *
 * @see utils/ffmpeg-process.ts - Lifecycle de processos
 * @see utils/ffmpeg-args.ts - Builder de argumentos
 * @see utils/fifo-manager.ts - CRUD de FIFOs
 */
export class AudioManager extends EventEmitter {
  // Processos FFmpeg gerenciados
  private mainProcess: FFmpegProcessManager | null = null;
  private mp3Process: FFmpegProcessManager | null = null;
  private recognitionProcess: FFmpegProcessManager | null = null;

  // Gerenciador de FIFOs
  private fifoManager = new FifoManager();

  // Configuracao
  private config: AudioConfig;
  private streamingConfig?: StreamingConfig;

  // Estado
  private isCapturing: boolean = false;
  private isStreaming: boolean = false;
  private currentError?: string;
  private levelDb?: number;

  // Caminhos dos FIFOs
  private readonly fifoPaths: FifoPaths = {
    mp3Fifo: '/tmp/vinyl-audio.fifo',
    recognitionFifo: '/tmp/vinyl-recognition.fifo',
    flacFifo: '/tmp/vinyl-flac.fifo',
  };

  // Rate limiting de logs
  private logRateLimiter = new Map<string, number>();
  private LOG_RATE_LIMIT_MS = 5000;

  // Retry para recovery
  private retryCount = 0;
  private MAX_RETRIES = 3;

  // Ring Buffer para captura instantanea de audio (recognition)
  private recognitionBuffer: AudioRingBuffer;

  /**
   * Cria uma instancia do AudioManager
   * @param config Configuracao de captura de audio
   */
  constructor(config?: Partial<AudioConfig>) {
    super();

    // Configuracao padrao com overrides
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

    // Inicializar Ring Buffer para recognition (20 segundos de historico)
    this.recognitionBuffer = new AudioRingBuffer({
      ...DEFAULT_RING_BUFFER_CONFIG,
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
    });

    logger.info(`AudioManager initialized with device: ${this.config.device}, ` +
                `sampleRate: ${this.config.sampleRate}Hz, ` +
                `channels: ${this.config.channels}, ` +
                `bufferSize: ${this.config.bufferSize}`);
  }

  /**
   * Inicia a captura de audio (modo simples, sem streaming)
   */
  async start(): Promise<void> {
    if (this.isCapturing) {
      logger.warn('Audio capture already running');
      return;
    }

    try {
      await this.validateDevice();

      const args = FFmpegArgsBuilder.buildCaptureArgs(
        this.getFFmpegAudioConfig(),
        this.config.bufferSize
      );

      this.mainProcess = new FFmpegProcessManager({
        name: 'Main',
        args,
        onStderr: (data) => this.handleMainStderr(data),
        onExit: (code, signal) => this.handleMainExit(code, signal),
        onError: (err) => this.handleMainError(err),
        stdio: ['ignore', 'ignore', 'pipe'],
      });

      await this.mainProcess.start();

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
   * Para a captura de audio
   */
  async stop(): Promise<void> {
    if (!this.isCapturing || !this.mainProcess) {
      logger.warn('Audio capture not running');
      return;
    }

    await this.mainProcess.stop();
    this.resetState();

    logger.info('Audio capture stopped');
    this.emit('stopped');
  }

  /**
   * Reinicia a captura de audio
   */
  async restart(): Promise<void> {
    logger.info('Restarting audio capture');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.start();
  }

  /**
   * Retorna o status atual da captura
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
   * ALSA -> FFmpeg #1 (principal) -> stdout (Raw PCM) -> Express /stream.wav
   *                               -> FIFO1 (Raw PCM) -> FFmpeg #2 -> MP3 -> Icecast2
   *                               -> FIFO2 (Raw PCM) -> FFmpeg #3 -> Ring Buffer
   *                               -> FIFO3 (Raw PCM) -> FFmpeg #4 -> FLAC (RecordingManager)
   */
  async startStreaming(config: StreamingConfig): Promise<void> {
    // Validacao proativa: detectar estado inconsistente
    if (this.isStreaming) {
      const processExists = this.mainProcess?.isRunning();
      if (!processExists) {
        logger.warn('Detected inconsistent state: isStreaming=true but no process. Auto-recovering...');
        this.resetState();
      } else {
        logger.warn('Streaming already active');
        return;
      }
    }

    try {
      await this.validateDevice();
      this.streamingConfig = config;

      // Criar FIFOs
      await this.fifoManager.create([
        this.fifoPaths.mp3Fifo,
        this.fifoPaths.recognitionFifo,
        this.fifoPaths.flacFifo,
      ]);

      // Construir argumentos
      const mainArgs = FFmpegArgsBuilder.buildMainArgs(
        this.getFFmpegAudioConfig(),
        this.fifoPaths
      );
      const mp3Args = FFmpegArgsBuilder.buildMp3Args(
        this.fifoPaths.mp3Fifo,
        { sampleRate: this.config.sampleRate, channels: this.config.channels },
        this.getFFmpegStreamingConfig(config)
      );
      const recognitionArgs = FFmpegArgsBuilder.buildRecognitionArgs(
        this.fifoPaths.recognitionFifo,
        { sampleRate: this.config.sampleRate, channels: this.config.channels }
      );

      logger.info(`Starting main FFmpeg with args: ${mainArgs.join(' ')}`);
      logger.info(`Starting MP3 FFmpeg with args: ${mp3Args.join(' ')}`);
      logger.info(`Starting Recognition FFmpeg with args: ${recognitionArgs.join(' ')}`);

      // 1. Iniciar leitores dos FIFOs PRIMEIRO (importante para evitar bloqueio)

      // FFmpeg #2: MP3 -> Icecast
      this.mp3Process = new FFmpegProcessManager({
        name: 'MP3',
        args: mp3Args,
        onStderr: (data) => this.handleMp3Stderr(data),
        onExit: (code, signal) => this.handleMp3Exit(code, signal),
        onError: (err) => this.handleMp3Error(err),
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      await this.mp3Process.start();

      // FFmpeg #3: Recognition -> Ring Buffer
      this.recognitionProcess = new FFmpegProcessManager({
        name: 'Recognition',
        args: recognitionArgs,
        onStdout: (data) => this.recognitionBuffer.write(data),
        onStderr: (data) => this.handleRecognitionStderr(data),
        onExit: (code, signal) => this.handleRecognitionExit(code, signal),
        onError: (err) => this.handleRecognitionError(err),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await this.recognitionProcess.start();

      // Aguardar leitores abrirem FIFOs
      await new Promise(resolve => setTimeout(resolve, 100));

      // 2. FFmpeg #1: Main (ALSA -> stdout + FIFOs)
      this.mainProcess = new FFmpegProcessManager({
        name: 'Main',
        args: mainArgs,
        onStderr: (data) => this.handleMainStderr(data),
        onExit: (code, signal) => this.handleMainExit(code, signal),
        onError: (err) => this.handleMainError(err),
        useForceKill: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      await this.mainProcess.start();

      this.isCapturing = true;
      this.isStreaming = true;
      this.currentError = undefined;

      logger.info(`Dual streaming started: PCM->Express + MP3->Icecast2 (${config.icecastHost}:${config.icecastPort}${config.mountPoint})`);
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

      await this.cleanupOnError();
      throw error;
    }
  }

  /**
   * Para o streaming (todos os processos FFmpeg e auxiliares)
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      logger.warn('Streaming not active');
      return;
    }

    // Parar processos em paralelo
    const stopPromises: Promise<void>[] = [];

    if (this.mainProcess?.isRunning()) {
      stopPromises.push(this.mainProcess.stop());
    }
    if (this.mp3Process?.isRunning()) {
      stopPromises.push(this.mp3Process.stop());
    }
    if (this.recognitionProcess?.isRunning()) {
      stopPromises.push(this.recognitionProcess.stop());
    }

    await Promise.all(stopPromises);

    // Limpar Ring Buffer
    this.recognitionBuffer.clear();

    // Limpar FIFOs
    await this.fifoManager.cleanup([
      this.fifoPaths.mp3Fifo,
      this.fifoPaths.recognitionFifo,
      this.fifoPaths.flacFifo,
    ]);

    this.resetState();

    logger.info('Streaming stopped (all processes)');
    this.emit('streaming_stopped');
  }

  /**
   * Retorna o status atual do streaming (sincrono, sem listeners)
   */
  getStreamingStatus(): StreamingStatus {
    return {
      active: this.isStreaming,
      bitrate: this.streamingConfig?.bitrate || 0,
      mountPoint: this.streamingConfig?.mountPoint || '',
      listeners: undefined,
      error: this.currentError
    };
  }

  /**
   * Retorna o status atual do streaming com contagem de listeners
   */
  async getStreamingStatusWithListeners(): Promise<StreamingStatus> {
    const listeners = this.isStreaming ? await getListenerCount() : 0;

    return {
      active: this.isStreaming,
      bitrate: this.streamingConfig?.bitrate || 0,
      mountPoint: this.streamingConfig?.mountPoint || '',
      listeners,
      error: this.currentError
    };
  }

  /**
   * Captura audio do Ring Buffer para recognition
   *
   * @param seconds Segundos de audio para capturar (max: 20s)
   * @returns Buffer com dados PCM ou null se nao houver dados suficientes
   */
  captureFromBuffer(seconds: number): Buffer | null {
    if (!this.isStreaming) {
      logger.warn('Cannot capture: streaming not active');
      return null;
    }

    const maxSeconds = DEFAULT_RING_BUFFER_CONFIG.durationSeconds;
    if (seconds > maxSeconds) {
      logger.warn(`Requested ${seconds}s but max is ${maxSeconds}s, clamping`);
      seconds = maxSeconds;
    }

    return this.recognitionBuffer.read(seconds);
  }

  /**
   * Verifica se ha audio suficiente no buffer para captura
   */
  hasEnoughAudioForCapture(seconds: number): boolean {
    return this.recognitionBuffer.hasEnoughData(seconds);
  }

  /**
   * Retorna estatisticas do Ring Buffer
   */
  getRecognitionBufferStats(): RingBufferStats {
    return this.recognitionBuffer.getStats();
  }

  /**
   * Retorna quantos segundos de audio estao disponiveis no buffer
   */
  getAvailableAudioSeconds(): number {
    return this.recognitionBuffer.getAvailableSeconds();
  }

  /**
   * Retorna o caminho do FIFO3 para gravacao FLAC
   */
  getFlacFifoPath(): string {
    return this.fifoPaths.flacFifo;
  }

  /**
   * Retorna o stream WAV (stdout do FFmpeg)
   */
  getWavStream(): NodeJS.ReadableStream | null {
    if (!this.isStreaming || !this.mainProcess) {
      logger.warn('Cannot get WAV stream: streaming not active');
      return null;
    }

    return this.mainProcess.getStdout();
  }

  /**
   * Cleanup quando objeto e destruido
   */
  async cleanup(): Promise<void> {
    if (this.isCapturing) {
      await this.stop();
    }
  }

  // ============================================
  // Metodos privados
  // ============================================

  /**
   * Reseta atomicamente o estado interno
   */
  private resetState(): void {
    this.isCapturing = false;
    this.isStreaming = false;
    this.mainProcess = null;
    this.mp3Process = null;
    this.recognitionProcess = null;
    this.streamingConfig = undefined;
    this.currentError = undefined;
    this.recognitionBuffer.clear();
  }

  /**
   * Cleanup em caso de erro durante startStreaming
   */
  private async cleanupOnError(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    if (this.mainProcess?.isRunning()) {
      stopPromises.push(this.mainProcess.stop());
    }
    if (this.mp3Process?.isRunning()) {
      stopPromises.push(this.mp3Process.stop());
    }
    if (this.recognitionProcess?.isRunning()) {
      stopPromises.push(this.recognitionProcess.stop());
    }

    await Promise.all(stopPromises);

    await this.fifoManager.cleanup([
      this.fifoPaths.mp3Fifo,
      this.fifoPaths.recognitionFifo,
      this.fifoPaths.flacFifo,
    ]);

    this.resetState();
  }

  /**
   * Converte config para FFmpegAudioConfig
   */
  private getFFmpegAudioConfig(): FFmpegAudioConfig {
    return {
      device: this.config.device,
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
    };
  }

  /**
   * Converte StreamingConfig para FFmpegStreamingConfig
   */
  private getFFmpegStreamingConfig(config: StreamingConfig): FFmpegStreamingConfig {
    return {
      icecastHost: config.icecastHost,
      icecastPort: config.icecastPort,
      icecastPassword: config.icecastPassword,
      mountPoint: config.mountPoint,
      bitrate: config.bitrate,
    };
  }

  /**
   * Valida se o device ALSA esta disponivel
   */
  private async validateDevice(): Promise<void> {
    return new Promise((resolve, reject) => {
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

  // ============================================
  // Handlers de processo
  // ============================================

  private handleMainStderr(output: string): void {
    if (this.isNonCriticalLog(output)) return;

    const logKey = `stderr-${output.substring(0, 50)}`;
    if (!this.shouldLog(logKey)) return;

    logger.info(`FFmpeg stderr: ${output}`);

    if (this.detectDeviceError(output)) {
      this.handleDeviceDisconnected(output);
    }

    if (output.includes('error') || output.includes('Error')) {
      logger.error(`FFmpeg ERROR detected: ${output}`);
    }
  }

  private handleMainExit(code: number | null, signal: NodeJS.Signals | null): void {
    const isControlledShutdown =
      (code === null || code === 0) &&
      (!signal || signal === 'SIGTERM' || signal === 'SIGKILL');

    if ((this.isCapturing || this.isStreaming) && !isControlledShutdown) {
      const wasStreaming = this.isStreaming;
      this.resetState();

      if (code !== 0 && code !== null) {
        const errorMsg = `FFmpeg exited unexpectedly with code ${code}`;
        this.currentError = errorMsg;
        logger.error(errorMsg);
        this.emit('error', { code, message: errorMsg });

        if (wasStreaming) {
          this.handleUnexpectedExit(code).catch(err => {
            logger.error(`Recovery handler failed: ${err}`);
          });
        }
      }

      if (wasStreaming) {
        this.emit('streaming_stopped');
      }
    }
  }

  private handleMainError(err: Error): void {
    this.resetState();
    this.currentError = err.message;
    logger.error(`FFmpeg process error: ${err.message}`);
    this.emit('error', { message: err.message });
  }

  private handleMp3Stderr(output: string): void {
    if (this.isNonCriticalLog(output)) return;

    const logKey = `mp3-stderr-${output.substring(0, 50)}`;
    if (!this.shouldLog(logKey)) return;

    logger.info(`FFmpeg MP3 stderr: ${output}`);

    if (output.includes('error') || output.includes('Error')) {
      logger.error(`FFmpeg MP3 ERROR: ${output}`);
    }
  }

  private handleMp3Exit(code: number | null, signal: NodeJS.Signals | null): void {
    logger.info(`FFmpeg MP3 process exited with code ${code}, signal ${signal}`);

    if (code !== 0 && code !== null && this.isStreaming) {
      logger.error(`FFmpeg MP3 exited unexpectedly with code ${code}`);
    }
  }

  private handleMp3Error(err: Error): void {
    logger.error(`FFmpeg MP3 process error: ${err.message}`);
  }

  private handleRecognitionStderr(output: string): void {
    if (this.isNonCriticalLog(output)) return;

    const logKey = `recognition-stderr-${output.substring(0, 50)}`;
    if (!this.shouldLog(logKey)) return;

    logger.info(`FFmpeg Recognition stderr: ${output}`);

    if (output.includes('error') || output.includes('Error')) {
      logger.error(`FFmpeg Recognition ERROR: ${output}`);
    }
  }

  private handleRecognitionExit(code: number | null, signal: NodeJS.Signals | null): void {
    logger.info(`FFmpeg Recognition process exited with code ${code}, signal ${signal}`);

    if (code !== 0 && code !== null && this.isStreaming) {
      logger.error(`FFmpeg Recognition exited unexpectedly with code ${code}`);
    }
  }

  private handleRecognitionError(err: Error): void {
    logger.error(`FFmpeg Recognition process error: ${err.message}`);
  }

  // ============================================
  // Utilitarios
  // ============================================

  private detectDeviceError(output: string): boolean {
    const deviceErrors = [
      'No such file or directory',
      'Device or resource busy',
      'No such device',
      'Cannot open audio device'
    ];
    return deviceErrors.some(error => output.includes(error));
  }

  private handleDeviceDisconnected(output: string): void {
    const errorMsg = `Device disconnected: ${output.trim()}`;
    this.currentError = errorMsg;
    logger.error(errorMsg);

    this.emit('device_disconnected', {
      device: this.config.device,
      error: errorMsg
    });

    this.stop().catch(err => {
      logger.error(`Failed to stop after device disconnect: ${err.message}`);
    });
  }

  private async handleUnexpectedExit(code: number): Promise<void> {
    if (this.retryCount >= this.MAX_RETRIES) {
      logger.error('Max retries reached, giving up');
      this.emit('recovery_failed', {
        retries: this.retryCount,
        lastError: this.currentError
      });
      return;
    }

    this.retryCount++;
    const delay = Math.pow(2, this.retryCount - 1) * 1000;

    logger.warn(`FFmpeg crashed, retrying in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      if (this.streamingConfig) {
        await this.startStreaming(this.streamingConfig);
        this.retryCount = 0;
        logger.info('FFmpeg recovery successful');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Retry failed: ${errorMsg}`);
      await this.handleUnexpectedExit(code);
    }
  }

  private isNonCriticalLog(output: string): boolean {
    const nonCriticalPatterns = [
      'non monotonically increasing dts',
      'Application provided invalid',
      'Past duration',
      'DTS out of order',
    ];
    return nonCriticalPatterns.some(pattern => output.includes(pattern));
  }

  private shouldLog(key: string): boolean {
    const now = Date.now();
    const lastLog = this.logRateLimiter.get(key) || 0;

    if (now - lastLog > this.LOG_RATE_LIMIT_MS) {
      this.logRateLimiter.set(key, now);
      return true;
    }
    return false;
  }
}

/**
 * Configuracao padrao de audio
 */
export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  device: 'plughw:1,0',
  sampleRate: 48000,
  channels: 2,
  bitDepth: 16,
  bufferSize: 1024
};
