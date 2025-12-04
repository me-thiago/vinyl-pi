import { spawn, exec, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { unlink, access } from 'fs';
import { promisify } from 'util';
import { createLogger } from '../utils/logger';
import { getListenerCount } from './icecast-stats';

const execAsync = promisify(exec);
const unlinkAsync = promisify(unlink);
const accessAsync = promisify(access);

const logger = createLogger('AudioManager');

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
 *
 * ⚠️ LIFECYCLE NOTE: This is a long-lived singleton service that exists
 * for the entire application lifetime. EventBus subscriptions (when added)
 * are intentionally NOT cleaned up, as this service is never destroyed
 * during normal operation.
 *
 * If you need to create components with shorter lifecycles that use EventBus,
 * see utils/lifecycle.ts for proper cleanup patterns.
 *
 * Example of proper EventBus usage (for future integration):
 * ```typescript
 * // When adding EventBus subscriptions to AudioManager:
 * import { eventBus, EventHandler } from '../utils/event-bus';
 *
 * class AudioManager extends EventEmitter {
 *   // For singletons: No need to store handlers for cleanup
 *   constructor() {
 *     // ✅ OK for singletons: Direct subscription without cleanup
 *     eventBus.subscribe('audio.start', async (payload) => {
 *       this.handleAudioStart(payload);
 *     });
 *   }
 *   // ✅ No destroy() method needed - singleton lives forever
 * }
 * ```
 *
 * For short-lived components, use this pattern instead:
 * ```typescript
 * import { createSubscriptionManager, Destroyable } from '../utils/lifecycle';
 *
 * class SessionManager implements Destroyable {
 *   private subscriptions = createSubscriptionManager();
 *
 *   constructor() {
 *     // ✅ Tracked for cleanup
 *     this.subscriptions.subscribe('silence.detected', async (p) => {...});
 *   }
 *
 *   async destroy() {
 *     // ✅ Automatic cleanup of all subscriptions
 *     this.subscriptions.cleanup();
 *   }
 * }
 * ```
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
  private logRateLimiter = new Map<string, number>();
  private LOG_RATE_LIMIT_MS = 5000; // Log mesmo erro max 1x/5s
  private retryCount = 0;
  private MAX_RETRIES = 3;

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
      const processRef = this.ffmpegProcess;

      const cleanup = () => {
        if (cleanupCalled) return;  // ✅ Idempotente - evita múltiplas execuções
        cleanupCalled = true;

        this.resetState();  // ✅ Reset atômico de TODAS as flags
        logger.info('Audio capture stopped');
        this.emit('stopped');
        resolve();
      };

      // Event handler: chamado quando processo terminar (SIGTERM ou SIGKILL)
      processRef.once('exit', cleanup);

      // Enviar SIGTERM para parar graciosamente
      processRef.kill('SIGTERM');

      // Timeout: SIGKILL se processo não terminar em 2s (reduzido de 5s)
      setTimeout(() => {
        if (!processRef || cleanupCalled) return;

        if (!processRef.killed) {
          logger.warn('FFmpeg did not stop gracefully, sending SIGKILL');
          processRef.kill('SIGKILL');
        }

        // Aguardar mais 500ms para evento 'exit' após SIGKILL
        // Se evento não ocorrer, forçar kill -9 do sistema
        setTimeout(async () => {
          if (cleanupCalled) return;
          
          logger.warn('FFmpeg did not respond to SIGKILL, force killing');
          await this.forceKillProcess(processRef, 'FFmpeg main');
          cleanup();  // ✅ Safe: idempotente, não duplica se já foi chamado
        }, 500);
      }, 2000); // Timeout reduzido para 2s
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
      const mp3ProcessRef = this.ffmpegMp3Process;
      mp3ProcessRef.kill('SIGTERM');

      // Aguardar processo terminar com timeout mais agressivo
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(async () => {
          if (mp3ProcessRef && !mp3ProcessRef.killed) {
            logger.warn('MP3 FFmpeg did not stop gracefully, sending SIGKILL');
            mp3ProcessRef.kill('SIGKILL');
            
            // Force kill se SIGKILL não funcionar
            setTimeout(async () => {
              await this.forceKillProcess(mp3ProcessRef, 'FFmpeg MP3');
              resolve();
            }, 500);
          } else {
            resolve();
          }
        }, 2000); // Timeout reduzido para 2s

        mp3ProcessRef?.once('exit', () => {
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
   * Retorna o status atual do streaming (síncrono, sem listeners)
   * @returns Status do streaming
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
   * @returns Status do streaming com listeners
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
      
      // Filtrar logs não-críticos
      if (this.isNonCriticalLog(output)) {
        return;
      }

      // Rate limit logs repetidos
      const logKey = `mp3-stderr-${output.substring(0, 50)}`;
      if (!this.shouldLog(logKey)) {
        return;
      }

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

      // Filtrar logs não-críticos
      if (this.isNonCriticalLog(output)) {
        return;
      }

      // Rate limit logs repetidos
      const logKey = `stderr-${output.substring(0, 50)}`;
      if (!this.shouldLog(logKey)) {
        return;
      }

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
          
          // Tentar recovery automático se estava streaming
          if (wasStreaming) {
            this.handleUnexpectedExit(code).catch(err => {
              logger.error(`Recovery handler failed: ${err}`);
            });
          }
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
   * Trata saída inesperada do FFmpeg com retry automático
   * @private
   */
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
    const delay = Math.pow(2, this.retryCount - 1) * 1000; // 1s, 2s, 4s
    
    logger.warn(`FFmpeg crashed, retrying in ${delay}ms (attempt ${this.retryCount}/${this.MAX_RETRIES})`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      if (this.streamingConfig) {
        await this.startStreaming(this.streamingConfig);
        this.retryCount = 0; // Reset on success
        logger.info('FFmpeg recovery successful');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error(`Retry failed: ${errorMsg}`);
      await this.handleUnexpectedExit(code);
    }
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
   * Force kill de um processo usando kill -9 do sistema
   * @private
   */
  private async forceKillProcess(
    process: ChildProcess | null,
    name: string
  ): Promise<void> {
    if (!process || !process.pid) return;
    
    const pid = process.pid;
    
    // Verificar se processo ainda existe
    try {
      process.kill(0); // Apenas testa se existe
    } catch {
      return; // Processo já morreu
    }
    
    // Force kill com comando do sistema
    try {
      await execAsync(`kill -9 ${pid}`);
      logger.info(`Force killed ${name} process (PID ${pid})`);
    } catch (err) {
      logger.warn(`Could not force kill ${name}: ${err}`);
    }
  }

  /**
   * Filtrar logs não-críticos do FFmpeg para reduzir volume
   * @private
   */
  private isNonCriticalLog(output: string): boolean {
    const nonCriticalPatterns = [
      'non monotonically increasing dts',
      'Application provided invalid',
      'Past duration',
      'DTS out of order',
    ];
    return nonCriticalPatterns.some(pattern => output.includes(pattern));
  }

  /**
   * Verificar se deve logar baseado em rate limiting
   * @private
   */
  private shouldLog(key: string): boolean {
    const now = Date.now();
    const lastLog = this.logRateLimiter.get(key) || 0;
    
    if (now - lastLog > this.LOG_RATE_LIMIT_MS) {
      this.logRateLimiter.set(key, now);
      return true;
    }
    return false;
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
