import winston from 'winston';
import { eventBus, EventHandler } from '../utils/event-bus';
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
 * EventDetector - Detecta eventos de áudio baseado em níveis
 * 
 * Responsabilidades:
 * - Escuta eventos 'audio.level' do EventBus
 * - Detecta silêncio (nível abaixo do threshold por duração configurada)
 * - Emite eventos 'silence.detected' e 'silence.ended'
 * - Fornece status atual via getSilenceStatus()
 * 
 * Configuração:
 * - threshold: -50dB (default) - abaixo disso é considerado silêncio
 * - duration: 10s (default) - tempo para confirmar silêncio
 * 
 * Uso:
 * ```typescript
 * const detector = new EventDetector({ threshold: -50, duration: 10 });
 * detector.start();
 * 
 * // EventDetector automaticamente escuta 'audio.level' do EventBus
 * // e emite 'silence.detected' quando apropriado
 * 
 * // Verificar status
 * const isSilent = detector.getSilenceStatus();
 * 
 * // Cleanup
 * await detector.destroy();
 * ```
 */
export class EventDetector {
  private config: SilenceDetectionConfig;
  private subscriptions = createSubscriptionManager();
  private isRunning: boolean = false;
  
  // Estado de detecção de silêncio
  private isSilent: boolean = false;
  private silenceStartTime: number | null = null;
  private lastLevelDb: number = -100;
  private silenceEmitted: boolean = false;
  private lastSilenceDuration: number = 0;

  constructor(config?: Partial<SilenceDetectionConfig>) {
    this.config = {
      threshold: config?.threshold ?? -50,
      duration: config?.duration ?? 10
    };

    logger.info(`EventDetector initialized: threshold=${this.config.threshold}dB, ` +
                `duration=${this.config.duration}s`);
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

    // Verificar se está abaixo do threshold (silêncio)
    const isBelowThreshold = levelDb < this.config.threshold;

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
      if (silenceDuration >= this.config.duration && !this.silenceEmitted) {
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
   * Emite evento silence.detected
   */
  private async emitSilenceDetected(levelDb: number, duration: number): Promise<void> {
    const payload: SilenceDetectedPayload = {
      timestamp: new Date().toISOString(),
      levelDb,
      duration,
      threshold: this.config.threshold
    };

    logger.info(`Silence detected: level=${levelDb.toFixed(1)}dB, ` +
                `duration=${duration.toFixed(1)}s, threshold=${this.config.threshold}dB`);

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
   * Retorna a configuração atual
   */
  getConfig(): SilenceDetectionConfig {
    return { ...this.config };
  }

  /**
   * Atualiza a configuração de threshold
   */
  setThreshold(threshold: number): void {
    this.config.threshold = threshold;
    logger.info(`Threshold updated to ${threshold}dB`);
  }

  /**
   * Atualiza a configuração de duração
   */
  setDuration(duration: number): void {
    this.config.duration = duration;
    logger.info(`Duration updated to ${duration}s`);
  }

  /**
   * Retorna se o detector está rodando
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Retorna informações de status completas
   */
  getStatus(): {
    isRunning: boolean;
    isSilent: boolean;
    lastLevelDb: number;
    config: SilenceDetectionConfig;
  } {
    return {
      isRunning: this.isRunning,
      isSilent: this.isSilent,
      lastLevelDb: this.lastLevelDb,
      config: { ...this.config }
    };
  }
}

/**
 * Singleton instance para uso global
 */
export const eventDetector = new EventDetector();

