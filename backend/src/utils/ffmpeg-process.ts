import { spawn, exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { Readable } from 'stream';
import { createLogger } from './logger';

const execAsync = promisify(exec);

/**
 * Configuração para FFmpegProcessManager
 */
export interface FFmpegProcessConfig {
  /** Nome do processo (para logs) */
  name: string;

  /** Argumentos FFmpeg */
  args: string[];

  /** Handler para dados stdout (Buffer) */
  onStdout?: (data: Buffer) => void;

  /** Handler para dados stderr (string) */
  onStderr?: (data: string) => void;

  /** Handler para saída do processo */
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;

  /** Handler para erro do processo */
  onError?: (error: Error) => void;

  /** Timeout em ms para aguardar SIGTERM (default: 2000) */
  stopTimeoutMs?: number;

  /** Delay adicional em ms após SIGKILL para forceKill (default: 500, só se useForceKill=true) */
  forceKillDelayMs?: number;

  /** Se true, usa kill -9 do sistema como último recurso (default: false) */
  useForceKill?: boolean;

  /** Configuração stdio para spawn (default: ['ignore', 'pipe', 'pipe']) */
  stdio?: ('pipe' | 'ignore' | 'inherit')[];
}

/**
 * Gerenciador de lifecycle de um processo FFmpeg
 *
 * Esta classe encapsula a lógica de spawn, shutdown gracioso,
 * e cleanup forçado de processos FFmpeg.
 *
 * @example
 * ```typescript
 * const manager = new FFmpegProcessManager({
 *   name: 'Main',
 *   args: ['-f', 'alsa', '-i', 'plughw:1,0', '-f', 's16le', 'pipe:1'],
 *   onStdout: (data) => ringBuffer.write(data),
 *   onStderr: (msg) => console.log(msg),
 *   useForceKill: true,  // Para processo principal
 * });
 *
 * await manager.start();
 * // ... uso ...
 * await manager.stop();
 * ```
 */
export class FFmpegProcessManager {
  private process: ChildProcess | null = null;
  private config: Required<
    Pick<FFmpegProcessConfig, 'name' | 'args' | 'stopTimeoutMs' | 'forceKillDelayMs' | 'useForceKill'>
  > &
    FFmpegProcessConfig;
  private logger: ReturnType<typeof createLogger>;
  private isStarted: boolean = false;
  private isStopping: boolean = false;

  constructor(config: FFmpegProcessConfig) {
    this.config = {
      stopTimeoutMs: 2000,
      forceKillDelayMs: 500,
      useForceKill: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...config,
    };
    this.logger = createLogger(`FFmpeg:${config.name}`);
  }

  /**
   * Inicia o processo FFmpeg
   *
   * @throws Error se processo já estiver rodando
   */
  async start(): Promise<void> {
    if (this.isStarted || this.process) {
      this.logger.warn('Process already started');
      return;
    }

    this.logger.info(`Starting with args: ${this.config.args.join(' ')}`);

    this.process = spawn('ffmpeg', this.config.args, {
      stdio: this.config.stdio as ('pipe' | 'ignore' | 'inherit')[],
    });

    this.setupHandlers();
    this.isStarted = true;

    this.logger.info('Process started successfully');
  }

  /**
   * Para o processo FFmpeg graciosamente
   *
   * Sequência de shutdown:
   * 1. SIGTERM
   * 2. Aguarda stopTimeoutMs (default 2s)
   * 3. SIGKILL se ainda rodando
   * 4. Se useForceKill=true: aguarda forceKillDelayMs, então kill -9
   */
  async stop(): Promise<void> {
    if (!this.process || !this.isStarted) {
      this.logger.debug('Process not running, nothing to stop');
      return;
    }

    if (this.isStopping) {
      this.logger.debug('Stop already in progress');
      return;
    }

    this.isStopping = true;

    return new Promise<void>((resolve) => {
      const processRef = this.process;
      if (!processRef) {
        this.cleanup();
        resolve();
        return;
      }

      let cleanupDone = false;

      const doCleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        this.cleanup();
        resolve();
      };

      // Handler para quando processo terminar
      processRef.once('exit', () => {
        this.logger.info('Process exited');
        doCleanup();
      });

      // Enviar SIGTERM
      this.logger.debug('Sending SIGTERM');
      processRef.kill('SIGTERM');

      // Timeout para SIGKILL
      setTimeout(async () => {
        if (cleanupDone || !processRef) return;

        if (!processRef.killed) {
          this.logger.warn('Process did not stop gracefully, sending SIGKILL');
          processRef.kill('SIGKILL');
        }

        // Se useForceKill, aguardar mais e usar kill -9 do sistema
        if (this.config.useForceKill) {
          setTimeout(async () => {
            if (cleanupDone) return;

            this.logger.warn('Process did not respond to SIGKILL, force killing');
            await this.forceKill(processRef);
            doCleanup();
          }, this.config.forceKillDelayMs);
        } else {
          // Sem forceKill, apenas aguardar um pouco e finalizar
          setTimeout(() => {
            if (!cleanupDone) {
              this.logger.debug('Cleanup after SIGKILL timeout');
              doCleanup();
            }
          }, 100);
        }
      }, this.config.stopTimeoutMs);
    });
  }

  /**
   * Verifica se o processo está rodando
   */
  isRunning(): boolean {
    return this.isStarted && this.process !== null && !this.process.killed;
  }

  /**
   * Retorna o processo FFmpeg (para acesso direto se necessário)
   */
  getProcess(): ChildProcess | null {
    return this.process;
  }

  /**
   * Retorna o stdout do processo (para streaming)
   */
  getStdout(): Readable | null {
    return this.process?.stdout ?? null;
  }

  /**
   * Retorna o stderr do processo
   */
  getStderr(): Readable | null {
    return this.process?.stderr ?? null;
  }

  /**
   * Retorna o PID do processo
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Configura handlers para stdout, stderr, exit e error
   */
  private setupHandlers(): void {
    if (!this.process) return;

    // Handler stdout
    if (this.config.onStdout && this.process.stdout) {
      this.process.stdout.on('data', this.config.onStdout);
    }

    // Handler stderr
    if (this.process.stderr) {
      this.process.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        this.config.onStderr?.(output);
      });
    }

    // Handler exit
    this.process.on('exit', (code, signal) => {
      this.config.onExit?.(code, signal);
    });

    // Handler error
    this.process.on('error', (error) => {
      this.logger.error(`Process error: ${error.message}`);
      this.config.onError?.(error);
    });
  }

  /**
   * Limpa estado interno
   */
  private cleanup(): void {
    this.process = null;
    this.isStarted = false;
    this.isStopping = false;
  }

  /**
   * Force kill usando kill -9 do sistema
   */
  private async forceKill(process: ChildProcess): Promise<void> {
    if (!process.pid) return;

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
      this.logger.info(`Force killed process (PID ${pid})`);
    } catch (err) {
      this.logger.warn(`Could not force kill: ${err}`);
    }
  }
}
