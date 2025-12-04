import prisma from '../prisma/client';
import { EventType } from '@prisma/client';
export { EventType } from '@prisma/client';
import { createSubscriptionManager, Destroyable } from '../utils/lifecycle';
import { createLogger } from '../utils/logger';
import {
  SilenceDetectedPayload,
  SilenceEndedPayload,
  ClippingDetectedPayload
} from './event-detector';
import { SessionManager } from './session-manager';

const logger = createLogger('EventPersistence');

/**
 * Tipos de eventos que serão persistidos (re-exporta do Prisma)
 */
export type PersistableEventType = EventType;

/**
 * EventPersistence - Persiste eventos do EventBus no banco de dados
 *
 * Responsabilidades:
 * - Escuta eventos do EventBus (silence, clipping, session, track)
 * - Persiste eventos na tabela audio_events via Prisma
 * - Armazena metadata como JSON
 * - Relaciona eventos com sessões quando aplicável
 *
 * Características:
 * - Fire-and-forget: persistência não bloqueia o EventBus
 * - Erros são logados mas não propagados
 * - Usa SubscriptionManager para cleanup seguro
 *
 * Uso:
 * ```typescript
 * const persistence = new EventPersistence();
 * persistence.start();
 *
 * // Cleanup
 * await persistence.destroy();
 * ```
 */
export class EventPersistence implements Destroyable {
  private subscriptions = createSubscriptionManager();
  private isRunning: boolean = false;
  private currentSessionId: string | null = null;
  private persistedCount: number = 0;
  private errorCount: number = 0;
  private sessionManager: SessionManager | null = null;

  /**
   * Inicia o serviço de persistência
   * Subscreve aos eventos relevantes do EventBus
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('EventPersistence already running');
      return;
    }

    // Subscrever aos eventos de áudio
    this.subscriptions.subscribe('silence.detected', this.handleSilenceDetected.bind(this));
    this.subscriptions.subscribe('silence.ended', this.handleSilenceEnded.bind(this));
    this.subscriptions.subscribe('clipping.detected', this.handleClippingDetected.bind(this));

    // Subscrever aos eventos de sessão (para futuro uso)
    this.subscriptions.subscribe('session.started', this.handleSessionStarted.bind(this));
    this.subscriptions.subscribe('session.ended', this.handleSessionEnded.bind(this));

    // Subscrever a track change (para futuro uso)
    this.subscriptions.subscribe('track.change.detected', this.handleTrackChange.bind(this));

    this.isRunning = true;
    logger.info('EventPersistence started');
  }

  /**
   * Para o serviço e limpa subscriptions
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('EventPersistence not running');
      return;
    }

    this.isRunning = false;
    this.subscriptions.cleanup();

    logger.info(`EventPersistence stopped (persisted: ${this.persistedCount}, errors: ${this.errorCount})`);
  }

  /**
   * Alias para stop() - compatibilidade com Destroyable
   */
  async destroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Handler para silence.detected
   */
  private async handleSilenceDetected(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as SilenceDetectedPayload;
    await this.persistEvent(EventType.silence_detected, {
      levelDb: data.levelDb,
      duration: data.duration,
      threshold: data.threshold
    });
  }

  /**
   * Handler para silence.ended
   */
  private async handleSilenceEnded(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as SilenceEndedPayload;
    await this.persistEvent(EventType.silence_ended, {
      levelDb: data.levelDb,
      silenceDuration: data.silenceDuration
    });
  }

  /**
   * Handler para clipping.detected
   */
  private async handleClippingDetected(payload: Record<string, unknown>): Promise<void> {
    const data = payload as unknown as ClippingDetectedPayload;
    await this.persistEvent(EventType.clipping_detected, {
      levelDb: data.levelDb,
      threshold: data.threshold,
      count: data.count
    });
  }

  /**
   * Handler para session.started
   * Armazena o sessionId para vincular eventos futuros
   */
  private async handleSessionStarted(payload: Record<string, unknown>): Promise<void> {
    const sessionId = payload.sessionId as string | undefined;
    if (sessionId) {
      this.currentSessionId = sessionId;
      logger.info(`Session started: ${sessionId}`);
    }
    await this.persistEvent(EventType.session_started, payload);
  }

  /**
   * Handler para session.ended
   * Limpa o sessionId atual
   */
  private async handleSessionEnded(payload: Record<string, unknown>): Promise<void> {
    await this.persistEvent(EventType.session_ended, payload);
    this.currentSessionId = null;
    logger.info('Session ended');
  }

  /**
   * Handler para track.change.detected
   */
  private async handleTrackChange(payload: Record<string, unknown>): Promise<void> {
    await this.persistEvent(EventType.track_change_detected, payload);
  }

  /**
   * Persiste um evento no banco de dados
   * Fire-and-forget: erros são logados mas não propagados
   */
  private async persistEvent(
    eventType: PersistableEventType,
    metadata: Record<string, unknown>
  ): Promise<void> {
    if (!this.isRunning) return;

    // Obter sessionId do SessionManager se disponível, senão usar o manual
    const sessionId = this.sessionManager?.getCurrentSessionId() ?? this.currentSessionId;

    try {
      await prisma.audioEvent.create({
        data: {
          eventType,
          sessionId,
          metadata: metadata as object,
          timestamp: new Date()
        }
      });

      this.persistedCount++;

      // Incrementar contador de eventos da sessão ativa
      if (this.sessionManager && sessionId) {
        this.sessionManager.incrementEventCount();
      }

      logger.debug(`Persisted event: ${eventType} (session: ${sessionId ?? 'none'})`);
    } catch (error) {
      this.errorCount++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to persist event ${eventType}: ${errorMsg}`);
      // Fire-and-forget: não propagar erro para não bloquear EventBus
    }
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStats(): {
    isRunning: boolean;
    persistedCount: number;
    errorCount: number;
    currentSessionId: string | null;
    subscriptionCount: number;
  } {
    return {
      isRunning: this.isRunning,
      persistedCount: this.persistedCount,
      errorCount: this.errorCount,
      currentSessionId: this.currentSessionId,
      subscriptionCount: this.subscriptions.getSubscriptionCount()
    };
  }

  /**
   * Define o sessionId atual manualmente
   * Útil para testes ou integração com gerenciamento de sessão externo
   */
  setCurrentSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
    if (sessionId) {
      logger.info(`Session ID set: ${sessionId}`);
    } else {
      logger.info('Session ID cleared');
    }
  }

  /**
   * Retorna o sessionId atual
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Define o SessionManager para integração
   * Permite obter sessionId automaticamente e incrementar contador de eventos
   */
  setSessionManager(sessionManager: SessionManager): void {
    this.sessionManager = sessionManager;
    logger.info('SessionManager connected');
  }
}
