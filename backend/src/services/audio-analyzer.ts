import Meyda from 'meyda';
import { eventBus } from '../utils/event-bus';
import { createLogger } from '../utils/logger';

const logger = createLogger('AudioAnalyzer');

/**
 * Configuração do AudioAnalyzer
 */
export interface AudioAnalyzerConfig {
  sampleRate: number;       // Sample rate em Hz (default: 48000)
  channels: number;         // Número de canais (default: 2)
  bufferSize: number;       // Tamanho do buffer para análise (default: 2048)
  publishIntervalMs: number; // Intervalo para publicar eventos (default: 100ms)
}

/**
 * Dados de análise de áudio
 */
export interface AudioAnalysisData {
  rms: number;              // Root Mean Square (0-1)
  levelDb: number;          // Nível em dB (tipicamente -100 a 0)
  energy: number;           // Energia do sinal
  timestamp: number;        // Unix timestamp
}

/**
 * AudioAnalyzer - Analisa chunks de áudio PCM e extrai métricas
 * 
 * Responsabilidades:
 * - Recebe chunks PCM (s16le stereo)
 * - Converte para formato compatível com Meyda
 * - Extrai features (RMS, energy, etc.)
 * - Publica eventos 'audio.level' no EventBus
 * 
 * Uso:
 * ```typescript
 * const analyzer = new AudioAnalyzer({ sampleRate: 48000, channels: 2 });
 * analyzer.start();
 * 
 * // No broadcaster de áudio:
 * source.on('data', (chunk) => {
 *   analyzer.analyze(chunk);
 * });
 * 
 * // Cleanup
 * analyzer.stop();
 * ```
 */
export class AudioAnalyzer {
  private config: AudioAnalyzerConfig;
  private isRunning: boolean = false;
  private lastPublishTime: number = 0;
  private accumulatedSamples: Float32Array;
  private accumulatedCount: number = 0;
  private currentLevelDb: number = -100;
  private currentRms: number = 0;

  constructor(config?: Partial<AudioAnalyzerConfig>) {
    this.config = {
      sampleRate: config?.sampleRate || 48000,
      channels: config?.channels || 2,
      bufferSize: config?.bufferSize || 2048,
      publishIntervalMs: config?.publishIntervalMs || 100
    };

    // Buffer para acumular samples antes de analisar
    this.accumulatedSamples = new Float32Array(this.config.bufferSize);

    logger.info(`AudioAnalyzer initialized: sampleRate=${this.config.sampleRate}, ` +
                `channels=${this.config.channels}, bufferSize=${this.config.bufferSize}`);
  }

  /**
   * Inicia o analyzer
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AudioAnalyzer already running');
      return;
    }

    this.isRunning = true;
    this.lastPublishTime = Date.now();
    this.accumulatedCount = 0;
    this.currentLevelDb = -100;
    this.currentRms = 0;

    logger.info('AudioAnalyzer started');
  }

  /**
   * Para o analyzer
   */
  stop(): void {
    if (!this.isRunning) {
      logger.warn('AudioAnalyzer not running');
      return;
    }

    this.isRunning = false;
    this.accumulatedCount = 0;
    
    logger.info('AudioAnalyzer stopped');
  }

  /**
   * Analisa um chunk de áudio PCM
   * 
   * @param chunk Buffer contendo dados PCM s16le (stereo interleaved)
   */
  analyze(chunk: Buffer): void {
    if (!this.isRunning) {
      return;
    }

    try {
      // Converter PCM s16le para Float32 mono (mix down stereo)
      const floatSamples = this.pcmToFloat32Mono(chunk);

      // Acumular samples
      for (let i = 0; i < floatSamples.length && this.accumulatedCount < this.config.bufferSize; i++) {
        this.accumulatedSamples[this.accumulatedCount++] = floatSamples[i];
      }

      // Se acumulamos samples suficientes, analisar
      if (this.accumulatedCount >= this.config.bufferSize) {
        this.performAnalysis();
        this.accumulatedCount = 0;
      }

      // Publicar no EventBus se passou o intervalo
      const now = Date.now();
      if (now - this.lastPublishTime >= this.config.publishIntervalMs) {
        this.publishAudioLevel();
        this.lastPublishTime = now;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Analysis error: ${errorMsg}`);
    }
  }

  /**
   * Converte buffer PCM s16le stereo para Float32 mono
   */
  private pcmToFloat32Mono(chunk: Buffer): Float32Array {
    // PCM s16le: cada sample é 2 bytes, stereo = 4 bytes por frame
    const bytesPerSample = 2;
    const channels = this.config.channels;
    const bytesPerFrame = bytesPerSample * channels;
    const frameCount = Math.floor(chunk.length / bytesPerFrame);

    const monoSamples = new Float32Array(frameCount);

    for (let i = 0; i < frameCount; i++) {
      const offset = i * bytesPerFrame;
      
      // Ler samples de cada canal (little-endian signed 16-bit)
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        const sampleOffset = offset + (ch * bytesPerSample);
        const sample = chunk.readInt16LE(sampleOffset);
        sum += sample;
      }

      // Mix para mono e normalizar para -1.0 a 1.0
      monoSamples[i] = (sum / channels) / 32768.0;
    }

    return monoSamples;
  }

  /**
   * Executa análise usando Meyda
   */
  private performAnalysis(): void {
    try {
      // Extrair features usando Meyda
      // Nota: Meyda.extract espera um array ou Float32Array
      const features = Meyda.extract(
        ['rms', 'energy'],
        this.accumulatedSamples
      );

      if (features && typeof features.rms === 'number') {
        this.currentRms = features.rms;
        
        // Converter RMS para dB
        // dB = 20 * log10(rms)
        // Evitar log(0) usando um valor mínimo
        const minRms = 0.00001; // -100dB
        const rmsValue = Math.max(features.rms, minRms);
        this.currentLevelDb = 20 * Math.log10(rmsValue);
        
        // Limitar range para -100 a 0 dB
        this.currentLevelDb = Math.max(-100, Math.min(0, this.currentLevelDb));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Meyda extraction error: ${errorMsg}`);
    }
  }

  /**
   * Publica evento de nível de áudio no EventBus
   */
  private async publishAudioLevel(): Promise<void> {
    const data: AudioAnalysisData = {
      rms: this.currentRms,
      levelDb: this.currentLevelDb,
      energy: this.currentRms * this.currentRms, // energy ≈ rms²
      timestamp: Date.now()
    };

    try {
      await eventBus.publish('audio.level', data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to publish audio.level: ${errorMsg}`);
    }
  }

  /**
   * Retorna o nível de áudio atual em dB
   */
  getCurrentLevelDb(): number {
    return this.currentLevelDb;
  }

  /**
   * Retorna o RMS atual (0-1)
   */
  getCurrentRms(): number {
    return this.currentRms;
  }

  /**
   * Retorna se o analyzer está rodando
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Retorna a configuração atual
   */
  getConfig(): AudioAnalyzerConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance para uso global
 */
export const audioAnalyzer = new AudioAnalyzer();

