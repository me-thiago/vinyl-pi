// src/captureService.ts
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import * as wav from 'wav';
import { prisma } from './db/client';

interface PCMConfig {
  device: string;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  recordingsDir: string;
}

interface RecordingMetadata {
  title?: string;
  artist?: string;
  album?: string;
  side?: string;
  notes?: string;
}

export class VinylCaptureService extends EventEmitter {
  private config: PCMConfig;
  private captureProcess: ChildProcess | null = null;
  private wavWriter: wav.FileWriter | null = null;
  private isCapturing: boolean = false;
  private currentRecordingId: string | null = null;
  private currentFilePath: string | null = null;
  private recordingStartTime: number = 0;
  private bytesWritten: number = 0;
  private maxRecordingTimeout: NodeJS.Timeout | null = null;
  private readonly MAX_RECORDING_DURATION = 28 * 60 * 1000; // 28 minutos em ms

  constructor(config: Partial<PCMConfig> = {}) {
    super();

    this.config = {
      device: config.device || process.env.AUDIO_DEVICE || 'plughw:1,0',
      sampleRate: config.sampleRate || parseInt(process.env.SAMPLE_RATE || '48000'),
      channels: config.channels || parseInt(process.env.CHANNELS || '2'),
      bitDepth: config.bitDepth || parseInt(process.env.BIT_DEPTH || '16'),
      recordingsDir: config.recordingsDir || process.env.RECORDINGS_DIR || './recordings'
    };

    // Criar diretório de gravações se não existir
    if (!fs.existsSync(this.config.recordingsDir)) {
      fs.mkdirSync(this.config.recordingsDir, { recursive: true });
    }

    // Cleanup orphaned recordings on startup
    this.cleanupOrphanedRecordings().catch(err => {
      console.error('Error cleaning up orphaned recordings:', err);
    });
  }

  private async cleanupOrphanedRecordings(): Promise<void> {
    console.log('Checking for orphaned recordings...');

    const orphaned = await prisma.recording.findMany({
      where: { status: 'recording' }
    });

    if (orphaned.length > 0) {
      console.log(`Found ${orphaned.length} orphaned recording(s), marking as failed...`);

      for (const rec of orphaned) {
        await prisma.recording.update({
          where: { id: rec.id },
          data: {
            status: 'failed',
            endedAt: new Date()
          }
        });
        console.log(`Marked recording ${rec.id} as failed`);
      }
    } else {
      console.log('No orphaned recordings found');
    }
  }

  private async checkDevice(): Promise<boolean> {
    return new Promise((resolve) => {
      const checkProcess = spawn('arecord', ['-l']);
      let output = '';

      checkProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      checkProcess.on('close', (code) => {
        if (code === 0) {
          const deviceFound = output.includes('card 1') || output.includes('USB Audio CODEC');
          console.log('Device check:', deviceFound ? 'Found' : 'Not found');
          resolve(deviceFound);
        } else {
          console.error('Failed to list audio devices');
          resolve(false);
        }
      });
    });
  }

  async startRecording(metadata: RecordingMetadata = {}): Promise<string> {
    if (this.isCapturing) {
      throw new Error('Recording already in progress');
    }

    console.log('Starting vinyl recording...');

    // Verificar se o device existe
    const deviceExists = await this.checkDevice();
    if (!deviceExists) {
      throw new Error('Audio device not found. Make sure Behringer UCA222 is connected.');
    }

    // Gerar nome de arquivo único
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `${timestamp}.wav`;
    this.currentFilePath = path.join(this.config.recordingsDir, filename);

    // Criar registro no banco de dados
    const recording = await prisma.recording.create({
      data: {
        filePath: this.currentFilePath,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        side: metadata.side,
        notes: metadata.notes,
        sampleRate: this.config.sampleRate,
        bitDepth: this.config.bitDepth,
        channels: this.config.channels,
        status: 'recording'
      }
    });

    this.currentRecordingId = recording.id;
    this.recordingStartTime = Date.now();
    this.bytesWritten = 0;

    // Criar WAV writer
    this.wavWriter = new wav.FileWriter(this.currentFilePath, {
      channels: this.config.channels,
      sampleRate: this.config.sampleRate,
      bitDepth: this.config.bitDepth
    });

    // Configurar argumentos do arecord
    const args = [
      '-D', this.config.device,
      '-f', `S${this.config.bitDepth}_LE`,
      '-r', this.config.sampleRate.toString(),
      '-c', this.config.channels.toString(),
      '-t', 'raw',
      '--buffer-time=2000000', // 2 segundos de buffer
      '-q' // Quiet mode
    ];

    try {
      this.captureProcess = spawn('arecord', args);
      this.isCapturing = true;

      // Pipe audio data para o arquivo WAV
      this.captureProcess.stdout?.pipe(this.wavWriter);

      // Handle data para emitir métricas
      this.captureProcess.stdout?.on('data', (chunk: Buffer) => {
        this.bytesWritten += chunk.length;

        // Emitir eventos para atualização de UI
        this.emit('data', chunk);
        this.emit('metrics', {
          recordingId: this.currentRecordingId,
          bytesWritten: this.bytesWritten,
          duration: (Date.now() - this.recordingStartTime) / 1000,
          timestamp: Date.now()
        });
      });

      // Handle stderr
      this.captureProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        if (!message.includes('overrun') && message.trim()) {
          console.warn('Capture warning:', message);
        }
      });

      // Handle process exit
      this.captureProcess.on('exit', async (code, signal) => {
        this.isCapturing = false;
        console.log('Capture process exited', { code, signal });

        // Fechar WAV writer
        if (this.wavWriter) {
          this.wavWriter.end();
        }

        // Atualizar status no banco
        if (this.currentRecordingId) {
          const duration = (Date.now() - this.recordingStartTime) / 1000;
          await prisma.recording.update({
            where: { id: this.currentRecordingId },
            data: {
              status: code === 0 ? 'stopped' : 'failed',
              endedAt: new Date(),
              durationSeconds: duration,
              fileSizeBytes: this.bytesWritten
            }
          });
        }

        this.emit('stopped', { code, recordingId: this.currentRecordingId });
      });

      // Handle process errors
      this.captureProcess.on('error', async (err) => {
        this.isCapturing = false;
        console.error('Failed to start capture process', err);

        // Atualizar status no banco
        if (this.currentRecordingId) {
          await prisma.recording.update({
            where: { id: this.currentRecordingId },
            data: { status: 'failed' }
          });
        }

        this.emit('error', err);
        throw err;
      });

      // Verificar se o processo iniciou corretamente
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          if (this.captureProcess && !this.captureProcess.killed) {
            console.log('Recording started successfully');
            resolve(true);
          } else {
            reject(new Error('Capture process failed to start'));
          }
        }, 1000);
      });

      // Set auto-stop timeout (28 minutes)
      this.maxRecordingTimeout = setTimeout(() => {
        console.log('Max recording duration reached (28 minutes), auto-stopping...');
        this.stopRecording().catch(err => {
          console.error('Error auto-stopping recording:', err);
        });
      }, this.MAX_RECORDING_DURATION);

      return recording.id;

    } catch (error) {
      this.isCapturing = false;
      console.error('Failed to start recording', error);

      // Limpar arquivo se criado
      if (this.currentFilePath && fs.existsSync(this.currentFilePath)) {
        fs.unlinkSync(this.currentFilePath);
      }

      // Atualizar status no banco
      if (this.currentRecordingId) {
        await prisma.recording.update({
          where: { id: this.currentRecordingId },
          data: { status: 'failed' }
        });
      }

      throw error;
    }
  }

  async stopRecording(): Promise<void> {
    if (!this.isCapturing || !this.captureProcess) {
      console.log('No recording to stop');
      return;
    }

    console.log('Stopping recording...');

    // Clear auto-stop timeout
    if (this.maxRecordingTimeout) {
      clearTimeout(this.maxRecordingTimeout);
      this.maxRecordingTimeout = null;
    }

    try {
      // Parar processo de captura
      this.captureProcess.kill('SIGTERM');

      // Aguardar o processo terminar
      await new Promise((resolve) => {
        let timeout = setTimeout(() => {
          if (this.captureProcess && !this.captureProcess.killed) {
            console.warn('Force killing capture process');
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

      // Fechar WAV writer
      if (this.wavWriter) {
        this.wavWriter.end();
        this.wavWriter = null;
      }

      // Atualizar registro no banco
      if (this.currentRecordingId) {
        const duration = (Date.now() - this.recordingStartTime) / 1000;

        // Obter tamanho real do arquivo
        let fileSize = this.bytesWritten;
        if (this.currentFilePath && fs.existsSync(this.currentFilePath)) {
          const stats = fs.statSync(this.currentFilePath);
          fileSize = stats.size;
        }

        await prisma.recording.update({
          where: { id: this.currentRecordingId },
          data: {
            status: 'stopped',
            endedAt: new Date(),
            durationSeconds: duration,
            fileSizeBytes: fileSize
          }
        });
      }

    } catch (error) {
      console.error('Error stopping recording', error);
    } finally {
      this.isCapturing = false;
      this.captureProcess = null;
      this.currentRecordingId = null;
      this.currentFilePath = null;
    }
  }

  getStatus() {
    return {
      isCapturing: this.isCapturing,
      currentRecordingId: this.currentRecordingId,
      currentFilePath: this.currentFilePath,
      duration: this.isCapturing ? (Date.now() - this.recordingStartTime) / 1000 : 0,
      bytesWritten: this.bytesWritten,
      config: this.config,
      processId: this.captureProcess?.pid || null
    };
  }
}

// Singleton instance
export const captureService = new VinylCaptureService();