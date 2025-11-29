import winston from 'winston';
import { eventBus } from '../utils/event-bus';
import { createSubscriptionManager } from '../utils/lifecycle';
import { AudioAnalysisData } from './audio-analyzer';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] [EventDetector] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/event-detector.log' })
  ]
});

/**
 * Configuração de detecção de silêncio
 */
export interface SilenceDetectionConfig {
  threshold: number;      // Threshold em dB (default: -50)
  duration: number;       // Duração em segundos para considerar silêncio (default: 10)
}

/**
 * Configuração de detecção de clipping
 */
export interface ClippingDetectionConfig {
  threshold: number;      // Threshold em dB (default: -1)
}

/**
 * Payload do evento silence.detected
 */
export interface SilenceDetectedPayload {
  timestamp: string;      // ISO timestamp
  levelDb: number;        // Nível de áudio atual em dB
  duration: number;       // Duração do silêncio em segundos
  threshold: number;      // Threshold configurado
}

/**
 * Payload do evento silence.ended
 */
export interface SilenceEndedPayload {
  timestamp: string;      // ISO timestamp
  levelDb: number;        // Nível de áudio atual em dB
  silenceDuration: number; // Quanto tempo ficou em silêncio (segundos)
}

/**
 * Payload do evento clipping.detected
 */
export interface ClippingDetectedPayload {
  timestamp: string;      // ISO timestamp
  levelDb: number;        // Nível de áudio atual em dB
  threshold: number;      // Threshold configurado
  count: number;          // Contagem total de eventos de clipping desde start
}

/**
 * Configuração combinada do EventDetector
 */
export interface EventDetectorConfig {
  silence: SilenceDetectionConfig;
  clipping: ClippingDetectionConfig;
}

/**
 * EventDetector - Detecta eventos de áudio baseado em níveis
 *
 * Responsabilidades:
 * - Escuta eventos 'audio.level' do EventBus
 * - Detecta silêncio (nível abaixo do threshold por duração configurada)
 * - Detecta clipping (nível acima do threshold de clipping)
 * - Emite eventos 'silence.detected', 'silence.ended', 'clipping.detected'
 * - Fornece status atual via getSilenceStatus() e getClippingCount()
 *
 * Configuração:
 * - silence.threshold: -50dB (default) - abaixo disso é considerado silêncio
 * - silence.duration: 10s (default) - tempo para confirmar silêncio
 * - clipping.threshold: -1dB (default) - acima disso é considerado clipping
 *
 * Uso:
 * ```typescript
 * const detector = new EventDetector({
 *   silence: { threshold: -50, duration: 10 },
 *   clipping: { threshold: -1 }
 * });
 * detector.start();
 *
 * // EventDetector automaticamente escuta 'audio.level' do EventBus
 * // e emite eventos quando apropriado
 *
 * // Verificar status
 * const isSilent = detector.getSilenceStatus();
 * const clippingCount = detector.getClippingCount();
 *
 * // Cleanup
 * await detector.destroy();
 * ```
 */
export class EventDetector {
  private silenceConfig: SilenceDetectionConfig;
  private clippingConfig: ClippingDetectionConfig;
  private subscriptions = createSubscriptionManager();
  private isRunning: boolean = false;

  // Estado de detecção de silêncio
  private isSilent: boolean = false;
  private silenceStartTime: number | null = null;
  private lastLevelDb: number = -100;
  private silenceEmitted: boolean = false;
  private lastSilenceDuration: number = 0;

  // Estado de detecção de clipping
  private clippingCount: number = 0;
  private lastClippingTime: number | null = null;

  constructor(config?: Partial<SilenceDetectionConfig> | { silence?: Partial<SilenceDetectionConfig>; clipping?: Partial<ClippingDetectionConfig> }) {
    // Suportar ambos os formatos de config para backward compatibility
    if (config && ('silence' in config || 'clipping' in config)) {
      // Novo formato com silence/clipping
      const typedConfig = config as { silence?: Partial<SilenceDetectionConfig>; clipping?: Partial<ClippingDetectionConfig> };
      this.silenceConfig = {
        threshold: typedConfig.silence?.threshold ?? -50,
        duration: typedConfig.silence?.duration ?? 10
      };
      this.clippingConfig = {
        threshold: typedConfig.clipping?.threshold ?? -1
      };
    } else {
      // Formato legado (apenas silence config)
      const legacyConfig = config as Partial<SilenceDetectionConfig> | undefined;
      this.silenceConfig = {
        threshold: legacyConfig?.threshold ?? -50,
        duration: legacyConfig?.duration ?? 10
      };
      this.clippingConfig = {
        threshold: -1
      };
    }

    logger.info(`EventDetector initialized: silence.threshold=${this.silenceConfig.threshold}dB, ` +
                `silence.duration=${this.silenceConfig.duration}s, ` +
                `clipping.threshold=${this.clippingConfig.threshold}dB`);
  }

  /**
   * Inicia o detector
   * Subscreve no EventBus para receber eventos 'audio.level'
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('EventDetector already running');
      return;
    }

    // Subscrever para eventos de nível de áudio
    this.subscriptions.subscribe('audio.level', this.handleAudioLevel.bind(this));

    this.isRunning = true;
    this.resetState();

    logger.info('EventDetector started');
  }

  /**
   * Para o detector e limpa subscriptions
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('EventDetector not running');
      return;
    }

    this.isRunning = false;
    this.subscriptions.cleanup();
    this.resetState();

    logger.info('EventDetector stopped');
  }

  /**
   * Alias para stop() - para compatibilidade com padrão Destroyable
   */
  async destroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Handler para eventos 'audio.level'
   */
  private async handleAudioLevel(payload: Record<string, unknown>): Promise<void> {
    if (!this.isRunning) return;

    // Extrair dados do payload com validação
    const data = payload as unknown as AudioAnalysisData;
    const levelDb = data.levelDb;
    const now = Date.now();

    this.lastLevelDb = levelDb;

    // Detectar clipping (nível acima do threshold de clipping)
    await this.checkClipping(levelDb, now);

    // Verificar se está abaixo do threshold (silêncio)
    const isBelowThreshold = levelDb < this.silenceConfig.threshold;

    if (isBelowThreshold) {
      // Áudio está em silêncio
      if (!this.silenceStartTime) {
        // Início de um período de silêncio
        this.silenceStartTime = now;
        logger.debug(`Silence started at level ${levelDb.toFixed(1)}dB`);
      }

      // Calcular duração do silêncio
      const silenceDuration = (now - this.silenceStartTime) / 1000;

      // Se duração atingiu o threshold e ainda não emitimos o evento
      if (silenceDuration >= this.silenceConfig.duration && !this.silenceEmitted) {
        this.isSilent = true;
        this.silenceEmitted = true;
        this.lastSilenceDuration = silenceDuration;

        await this.emitSilenceDetected(levelDb, silenceDuration);
      }
    } else {
      // Áudio retornou (acima do threshold)
      if (this.silenceStartTime) {
        const silenceDuration = (now - this.silenceStartTime) / 1000;

        // Se estávamos em silêncio confirmado, emitir fim
        if (this.silenceEmitted) {
          await this.emitSilenceEnded(levelDb, silenceDuration);
        }

        // Reset estado de silêncio
        this.silenceStartTime = null;
        this.isSilent = false;
        this.silenceEmitted = false;
        this.lastSilenceDuration = 0;

        logger.debug(`Audio returned at level ${levelDb.toFixed(1)}dB`);
      }
    }
  }

  /**
   * Verifica e emite evento de clipping se nível exceder threshold
   */
  private async checkClipping(levelDb: number, now: number): Promise<void> {
    if (levelDb > this.clippingConfig.threshold) {
      this.clippingCount++;
      this.lastClippingTime = now;

      await this.emitClippingDetected(levelDb);
    }
  }

  /**
   * Emite evento clipping.detected
   */
  private async emitClippingDetected(levelDb: number): Promise<void> {
    const payload: ClippingDetectedPayload = {
      timestamp: new Date().toISOString(),
      levelDb,
      threshold: this.clippingConfig.threshold,
      count: this.clippingCount
    };

    logger.warn(`Clipping detected: level=${levelDb.toFixed(1)}dB, ` +
                `threshold=${this.clippingConfig.threshold}dB, count=${this.clippingCount}`);

    try {
      await eventBus.publish('clipping.detected', payload);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to publish clipping.detected: ${errorMsg}`);
    }
  }

  /**
   * Emite evento silence.detected
   */
  private async emitSilenceDetected(levelDb: number, duration: number): Promise<void> {
    const payload: SilenceDetectedPayload = {
      timestamp: new Date().toISOString(),
      levelDb,
      duration,
      threshold: this.silenceConfig.threshold
    };

    logger.info(`Silence detected: level=${levelDb.toFixed(1)}dB, ` +
                `duration=${duration.toFixed(1)}s, threshold=${this.silenceConfig.threshold}dB`);

    try {
      await eventBus.publish('silence.detected', payload);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to publish silence.detected: ${errorMsg}`);
    }
  }

  /**
   * Emite evento silence.ended
   */
  private async emitSilenceEnded(levelDb: number, silenceDuration: number): Promise<void> {
    const payload: SilenceEndedPayload = {
      timestamp: new Date().toISOString(),
      levelDb,
      silenceDuration
    };

    logger.info(`Silence ended: level=${levelDb.toFixed(1)}dB, ` +
                `was silent for ${silenceDuration.toFixed(1)}s`);

    try {
      await eventBus.publish('silence.ended', payload);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to publish silence.ended: ${errorMsg}`);
    }
  }

  /**
   * Reseta estado interno
   */
  private resetState(): void {
    this.isSilent = false;
    this.silenceStartTime = null;
    this.lastLevelDb = -100;
    this.silenceEmitted = false;
    this.lastSilenceDuration = 0;
    this.clippingCount = 0;
    this.lastClippingTime = null;
  }

  /**
   * Retorna se está atualmente em silêncio
   */
  getSilenceStatus(): boolean {
    return this.isSilent;
  }

  /**
   * Retorna o último nível de áudio em dB
   */
  getLastLevelDb(): number {
    return this.lastLevelDb;
  }

  /**
   * Retorna a configuração de silêncio atual
   */
  getConfig(): SilenceDetectionConfig {
    return { ...this.silenceConfig };
  }

  /**
   * Atualiza a configuração de threshold de silêncio
   */
  setThreshold(threshold: number): void {
    this.silenceConfig.threshold = threshold;
    logger.info(`Silence threshold updated to ${threshold}dB`);
  }

  /**
   * Atualiza a configuração de duração de silêncio
   */
  setDuration(duration: number): void {
    this.silenceConfig.duration = duration;
    logger.info(`Silence duration updated to ${duration}s`);
  }

  /**
   * Retorna se o detector está rodando
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Retorna a contagem de eventos de clipping desde o start
   */
  getClippingCount(): number {
    return this.clippingCount;
  }

  /**
   * Retorna a configuração de clipping atual
   */
  getClippingConfig(): ClippingDetectionConfig {
    return { ...this.clippingConfig };
  }

  /**
   * Atualiza o threshold de clipping
   */
  setClippingThreshold(threshold: number): void {
    this.clippingConfig.threshold = threshold;
    logger.info(`Clipping threshold updated to ${threshold}dB`);
  }

  /**
   * Retorna informações de status completas
   */
  getStatus(): {
    isRunning: boolean;
    isSilent: boolean;
    lastLevelDb: number;
    clippingCount: number;
    config: SilenceDetectionConfig;
    clippingConfig: ClippingDetectionConfig;
  } {
    return {
      isRunning: this.isRunning,
      isSilent: this.isSilent,
      lastLevelDb: this.lastLevelDb,
      clippingCount: this.clippingCount,
      config: { ...this.silenceConfig },
      clippingConfig: { ...this.clippingConfig }
    };
  }
}

/**
 * Singleton instance para uso global
 */
export const eventDetector = new EventDetector();

