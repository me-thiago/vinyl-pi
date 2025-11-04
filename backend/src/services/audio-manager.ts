import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import winston from 'winston';

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
  private config: AudioConfig;
  private streamingConfig?: StreamingConfig;
  private isCapturing: boolean = false;
  private isStreaming: boolean = false;
  private currentError?: string;
  private levelDb?: number;

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
    this.streamingConfig = undefined;
    this.currentError = undefined;
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
   * Inicia streaming para Icecast2
   *
   * Detecta e corrige automaticamente estado inconsistente antes de iniciar.
   * Se isStreaming=true mas processo não existe, força reset e continua normalmente.
   *
   * @param config Configuração de streaming
   * @returns Promise que resolve quando streaming iniciar
   */
  async startStreaming(config: StreamingConfig): Promise<void> {
    // ✅ Validação proativa: detectar estado inconsistente
    if (this.isStreaming) {
      const processExists = this.ffmpegProcess && !this.ffmpegProcess.killed;

      if (!processExists) {
        // Estado inconsistente detectado: flag=true mas processo morto
        logger.warn('Detected inconsistent state: isStreaming=true but no process. Auto-recovering...');
        this.resetState();
        // Continua com start normal abaixo
      } else {
        // Estado OK: streaming realmente ativo
        logger.warn('Streaming already active');
        return;
      }
    }

    try {
      // Validar device ALSA antes de iniciar
      await this.validateDevice();

      // Armazenar config de streaming
      this.streamingConfig = config;

      // Construir comando FFmpeg com streaming
      const args = this.buildStreamingFFmpegArgs(config);

      logger.info(`Starting FFmpeg streaming with args: ${args.join(' ')}`);

      // Spawn processo FFmpeg
      this.ffmpegProcess = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe']  // stdin: ignore, stdout: ignore, stderr: pipe
      });

      // Configurar handlers
      this.setupProcessHandlers();

      this.isCapturing = true;
      this.isStreaming = true;
      this.currentError = undefined;

      logger.info(`Streaming started successfully to ${config.icecastHost}:${config.icecastPort}${config.mountPoint}`);
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
      throw error;
    }
  }

  /**
   * Para o streaming
   * @returns Promise que resolve quando streaming parar
   */
  async stopStreaming(): Promise<void> {
    if (!this.isStreaming) {
      logger.warn('Streaming not active');
      return;
    }

    await this.stop();
    this.isStreaming = false;
    this.streamingConfig = undefined;

    logger.info('Streaming stopped');
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
   * Constrói argumentos para o comando FFmpeg com streaming Icecast2
   * @private
   */
  private buildStreamingFFmpegArgs(streamConfig: StreamingConfig): string[] {
    const args: string[] = [];

    // Verbose logging para debug
    args.push('-loglevel', 'verbose');

    // Input ALSA principal
    args.push('-f', 'alsa');
    args.push('-i', this.config.device);
    args.push('-ar', this.config.sampleRate.toString());
    args.push('-ac', this.config.channels.toString());

    // TODO: Fallback anullsrc requer filtro complexo FFmpeg
    // Por enquanto desabilitado para validação básica
    // if (streamConfig.fallbackSilence) {
    //   args.push('-f', 'lavfi');
    //   args.push('-i', `anullsrc=channel_layout=stereo:sample_rate=${this.config.sampleRate}`);
    // }

    // Encoding MP3
    args.push('-acodec', 'libmp3lame');
    args.push('-ab', `${streamConfig.bitrate}k`);
    args.push('-b:a', `${streamConfig.bitrate}k`);
    args.push('-f', 'mp3');

    // Configurações adicionais
    args.push('-content_type', 'audio/mpeg');

    // URL Icecast2
    const icecastUrl = `icecast://source:${streamConfig.icecastPassword}@${streamConfig.icecastHost}:${streamConfig.icecastPort}${streamConfig.mountPoint}`;
    args.push(icecastUrl);

    return args;
  }

  /**
   * Configura handlers para o processo FFmpeg
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
