// src/liveStreamService.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

interface StreamConfig {
  device: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  chunkSize: number;
}

/**
 * Service for continuous audio streaming without recording to disk
 */
export class LiveStreamService extends EventEmitter {
  private config: StreamConfig;
  private captureProcess: ChildProcess | null = null;
  private isStreaming: boolean = false;
  private startTime: number = 0;
  private bytesProcessed: number = 0;
  private chunkBuffer: Buffer = Buffer.alloc(0);

  constructor(config: Partial<StreamConfig> = {}) {
    super();

    this.config = {
      device: config.device || process.env.AUDIO_DEVICE || 'plughw:1,0',
      sampleRate: config.sampleRate || parseInt(process.env.SAMPLE_RATE || '48000'),
      channels: config.channels || parseInt(process.env.CHANNELS || '2'),
      bitDepth: config.bitDepth || parseInt(process.env.BIT_DEPTH || '16'),
      chunkSize: config.chunkSize || parseInt(process.env.STREAMING_CHUNK_SIZE || '1024')
    };

    console.log('LiveStreamService initialized with config:', this.config);
  }

  /**
   * Start continuous audio capture for streaming
   */
  async start(): Promise<void> {
    if (this.isStreaming) {
      console.log('Live streaming already active');
      return;
    }

    console.log('Starting live audio streaming...');

    // Configurar argumentos do arecord
    const bufferTime = process.env.AUDIO_BUFFER_TIME || '2000000'; // 2s default
    const periodTime = process.env.AUDIO_PERIOD_TIME || '500000'; // 500ms default

    const args = [
      '-D', this.config.device,
      '-f', `S${this.config.bitDepth}_LE`,
      '-r', this.config.sampleRate.toString(),
      '-c', this.config.channels.toString(),
      '-t', 'raw',
      `--buffer-time=${bufferTime}`,
      `--period-time=${periodTime}`,
      '-q' // Quiet mode
    ];

    console.log(`Audio buffer settings: buffer=${parseInt(bufferTime)/1000}ms, period=${parseInt(periodTime)/1000}ms`);

    try {
      this.captureProcess = spawn('arecord', args);
      this.isStreaming = true;
      this.startTime = Date.now();
      this.bytesProcessed = 0;
      this.chunkBuffer = Buffer.alloc(0);

      console.log(`✅ arecord started (PID: ${this.captureProcess.pid})`);

      // Handle audio data
      this.captureProcess.stdout?.on('data', (chunk: Buffer) => {
        this.bytesProcessed += chunk.length;

        // Emitir chunk direto para streaming
        this.emit('data', chunk);

        // Emitir métricas periodicamente
        if (this.bytesProcessed % (this.config.sampleRate * 4) < chunk.length) { // ~1 vez por segundo
          this.emit('metrics', {
            bytesProcessed: this.bytesProcessed,
            duration: (Date.now() - this.startTime) / 1000,
            timestamp: Date.now()
          });
        }
      });

      // Handle stderr
      this.captureProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (!message.includes('overrun') && message.trim()) {
          console.warn('Live stream warning:', message);
        }
      });

      // Handle process exit
      this.captureProcess.on('exit', (code, signal) => {
        this.isStreaming = false;
        console.log('Live stream process exited', { code, signal });
        this.emit('stopped', { code, signal });
      });

      // Handle process errors
      this.captureProcess.on('error', (err) => {
        this.isStreaming = false;
        console.error('Failed to start live stream process', err);
        this.emit('error', err);
      });

      // Verificar se o processo iniciou corretamente
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (this.captureProcess && !this.captureProcess.killed) {
            console.log('✅ Live streaming started successfully');
            resolve(true);
          } else {
            reject(new Error('Live stream process failed to start'));
          }
        }, 500);
      });

    } catch (error) {
      this.isStreaming = false;
      console.error('Failed to start live streaming', error);
      throw error;
    }
  }

  /**
   * Stop live audio streaming
   */
  async stop(): Promise<void> {
    if (!this.isStreaming || !this.captureProcess) {
      console.log('No live stream to stop');
      return;
    }

    console.log('Stopping live stream...');

    try {
      // Parar processo de captura
      this.captureProcess.kill('SIGTERM');

      // Aguardar o processo terminar
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.captureProcess && !this.captureProcess.killed) {
            console.warn('Force killing live stream process');
            this.captureProcess.kill('SIGKILL');
          }
          resolve(true);
        }, 2000);

        if (this.captureProcess) {
          this.captureProcess.once('exit', () => {
            clearTimeout(timeout);
            resolve(true);
          });
        }
      });

      console.log('✅ Live stream stopped');

    } catch (error) {
      console.error('Error stopping live stream', error);
    } finally {
      this.isStreaming = false;
      this.captureProcess = null;
    }
  }

  /**
   * Get current streaming status
   */
  getStatus() {
    return {
      isStreaming: this.isStreaming,
      duration: this.isStreaming ? (Date.now() - this.startTime) / 1000 : 0,
      bytesProcessed: this.bytesProcessed,
      config: this.config,
      processId: this.captureProcess?.pid || null
    };
  }

  /**
   * Check if streaming is active
   */
  isActive(): boolean {
    return this.isStreaming;
  }
}

// Singleton instance
export const liveStreamService = new LiveStreamService();
