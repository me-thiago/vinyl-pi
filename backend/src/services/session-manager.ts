import winston from 'winston';
import prisma from '../prisma/client';
import { eventBus } from '../utils/event-bus';
import { createSubscriptionManager, Destroyable } from '../utils/lifecycle';

// Configurar logger Winston
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}] [SessionManager] ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/session-manager.log' })
  ]
});

/**
 * Estados da máquina de estados de sessão
 */
export type SessionState = 'idle' | 'active';

/**
 * Configuração do SessionManager
 */
export interface SessionManagerConfig {
  /** Tempo em segundos para considerar fim de sessão após silêncio (default: 1800 = 30min) */
  sessionTimeout: number;
  /** Threshold em dB para considerar que há áudio (default: -50) */
  audioThreshold: number;
}

/**
 * Payload do evento session.started
 */
export interface SessionStartedPayload {
  sessionId: string;
  timestamp: string;
}

/**
 * Payload do evento session.ended
 */
export interface SessionEndedPayload {
  sessionId: string;
  timestamp: string;
  durationSeconds: number;
  eventCount: number;
}

/**
 * Informações da sessão ativa
 */
export interface ActiveSessionInfo {
  id: string;
  startedAt: Date;
  durationSeconds: number;
  eventCount: number;
}

/**
 * SessionManager - Gerencia sessões de escuta do usuário
 *
 * Uma "sessão" representa um período contínuo de uso do toca-discos.
 *
 * Regras:
 * - Sessão INICIA quando detecta áudio após período idle
 * - Sessão TERMINA após silêncio prolongado (30min por padrão, configurável via SESSION_TIMEOUT)
 * - Eventos são vinculados à sessão ativa
 *
 * State Machine:
 * ```
 *   idle ──[áudio detectado]──► active
 *     ▲                            │
 *     └──[silêncio 30min]──────────┘
 * ```
 *
 * Uso:
 * ```typescript
 * const sessionManager = new SessionManager({
 *   sessionTimeout: 1800  // 30 minutos
 * });
 * sessionManager.start();
 *
 * // Verificar sessão ativa
 * const session = sessionManager.getActiveSession();
 *
 * // Cleanup
 * await sessionManager.destroy();
 * ```
 */
export class SessionManager implements Destroyable {
  private config: SessionManagerConfig;
  private subscriptions = createSubscriptionManager();
  private isRunning: boolean = false;

  // Estado da máquina de estados
  private state: SessionState = 'idle';
  private currentSessionId: string | null = null;
  private sessionStartTime: Date | null = null;
  private eventCount: number = 0;

  // Timer para timeout de sessão
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<SessionManagerConfig>) {
    this.config = {
      sessionTimeout: config?.sessionTimeout ?? 1800,
      audioThreshold: config?.audioThreshold ?? -50
    };

    logger.info(`SessionManager initialized: timeout=${this.config.sessionTimeout}s, threshold=${this.config.audioThreshold}dB`);
  }

  /**
   * Inicia o gerenciador de sessões
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('SessionManager already running');
      return;
    }

    // Escutar eventos de áudio para detectar início de sessão
    this.subscriptions.subscribe('audio.level', this.handleAudioLevel.bind(this));

    // Escutar eventos de silêncio para detectar fim de sessão
    this.subscriptions.subscribe('silence.detected', this.handleSilenceDetected.bind(this));
    this.subscriptions.subscribe('silence.ended', this.handleSilenceEnded.bind(this));

    this.isRunning = true;
    logger.info('SessionManager started');
  }

  /**
   * Para o gerenciador e encerra sessão ativa se houver
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('SessionManager not running');
      return;
    }

    // Encerrar sessão ativa se houver
    if (this.state === 'active' && this.currentSessionId) {
      await this.endSession('shutdown');
    }

    this.clearTimeoutTimer();
    this.subscriptions.cleanup();
    this.isRunning = false;

    logger.info('SessionManager stopped');
  }

  /**
   * Alias para stop() - compatibilidade com Destroyable
   */
  async destroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Handler para eventos audio.level
   * Detecta primeiro áudio para iniciar sessão
   */
  private async handleAudioLevel(payload: Record<string, unknown>): Promise<void> {
    if (!this.isRunning) return;

    const levelDb = payload.levelDb as number;

    // Se está idle e detectou áudio acima do threshold, iniciar sessão
    if (this.state === 'idle' && levelDb > this.config.audioThreshold) {
      await this.startSession();
    }
  }

  /**
   * Handler para silence.detected
   * Inicia timer de timeout para encerrar sessão
   */
  private async handleSilenceDetected(payload: Record<string, unknown>): Promise<void> {
    if (!this.isRunning || this.state !== 'active') return;

    logger.debug('Silence detected, starting session timeout timer');

    // Iniciar timer de timeout
    this.startTimeoutTimer();
  }

  /**
   * Handler para silence.ended
   * Cancela timer de timeout (usuário voltou a usar)
   */
  private async handleSilenceEnded(payload: Record<string, unknown>): Promise<void> {
    if (!this.isRunning) return;

    // Cancelar timer de timeout se houver
    if (this.timeoutTimer) {
      logger.debug('Silence ended, cancelling session timeout timer');
      this.clearTimeoutTimer();
    }
  }

  /**
   * Inicia uma nova sessão
   */
  private async startSession(): Promise<void> {
    if (this.state === 'active') {
      logger.warn('Attempted to start session while already active');
      return;
    }

    try {
      // Criar sessão no banco
      const session = await prisma.session.create({
        data: {
          startedAt: new Date(),
          eventCount: 0,
          durationSeconds: 0
        }
      });

      this.currentSessionId = session.id;
      this.sessionStartTime = session.startedAt;
      this.eventCount = 0;
      this.state = 'active';

      logger.info(`Session started: ${session.id}`);

      // Emitir evento session.started
      const startPayload: SessionStartedPayload = {
        sessionId: session.id,
        timestamp: session.startedAt.toISOString()
      };

      await eventBus.publish('session.started', startPayload);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start session: ${errorMsg}`);
    }
  }

  /**
   * Encerra a sessão atual
   */
  private async endSession(reason: 'timeout' | 'shutdown' = 'timeout'): Promise<void> {
    if (this.state !== 'active' || !this.currentSessionId || !this.sessionStartTime) {
      logger.warn('Attempted to end session while not active');
      return;
    }

    const sessionId = this.currentSessionId;
    const endTime = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - this.sessionStartTime.getTime()) / 1000);

    try {
      // Atualizar sessão no banco
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          endedAt: endTime,
          durationSeconds,
          eventCount: this.eventCount
        }
      });

      logger.info(`Session ended: ${sessionId} (duration: ${durationSeconds}s, events: ${this.eventCount}, reason: ${reason})`);

      // Emitir evento session.ended
      const endPayload: SessionEndedPayload = {
        sessionId,
        timestamp: endTime.toISOString(),
        durationSeconds,
        eventCount: this.eventCount
      };

      await eventBus.publish('session.ended', endPayload);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to end session: ${errorMsg}`);
    } finally {
      // Resetar estado
      this.currentSessionId = null;
      this.sessionStartTime = null;
      this.eventCount = 0;
      this.state = 'idle';
      this.clearTimeoutTimer();
    }
  }

  /**
   * Inicia o timer de timeout de sessão
   */
  private startTimeoutTimer(): void {
    this.clearTimeoutTimer();

    this.timeoutTimer = setTimeout(async () => {
      logger.info(`Session timeout reached (${this.config.sessionTimeout}s of silence)`);
      await this.endSession('timeout');
    }, this.config.sessionTimeout * 1000);
  }

  /**
   * Limpa o timer de timeout
   */
  private clearTimeoutTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  /**
   * Incrementa o contador de eventos da sessão ativa
   * Chamado pelo EventPersistence quando persiste um evento
   */
  incrementEventCount(): void {
    if (this.state === 'active') {
      this.eventCount++;
    }
  }

  /**
   * Retorna o ID da sessão ativa (ou null se idle)
   */
  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  /**
   * Retorna informações da sessão ativa
   */
  getActiveSession(): ActiveSessionInfo | null {
    if (this.state !== 'active' || !this.currentSessionId || !this.sessionStartTime) {
      return null;
    }

    const now = new Date();
    const durationSeconds = Math.floor((now.getTime() - this.sessionStartTime.getTime()) / 1000);

    return {
      id: this.currentSessionId,
      startedAt: this.sessionStartTime,
      durationSeconds,
      eventCount: this.eventCount
    };
  }

  /**
   * Retorna o estado atual
   */
  getState(): SessionState {
    return this.state;
  }

  /**
   * Retorna se está rodando
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Retorna a configuração atual
   */
  getConfig(): SessionManagerConfig {
    return { ...this.config };
  }

  /**
   * Atualiza o timeout de sessão
   */
  setSessionTimeout(timeout: number): void {
    this.config.sessionTimeout = timeout;
    logger.info(`Session timeout updated to ${timeout}s`);

    // Se tiver um timer ativo, reiniciar com o novo timeout
    if (this.timeoutTimer && this.state === 'active') {
      this.startTimeoutTimer();
    }
  }

  /**
   * Atualiza o threshold de áudio
   */
  setAudioThreshold(threshold: number): void {
    this.config.audioThreshold = threshold;
    logger.info(`Audio threshold updated to ${threshold}dB`);
  }

  /**
   * Retorna status completo para debug/API
   */
  getStatus(): {
    isRunning: boolean;
    state: SessionState;
    activeSession: ActiveSessionInfo | null;
    config: SessionManagerConfig;
  } {
    return {
      isRunning: this.isRunning,
      state: this.state,
      activeSession: this.getActiveSession(),
      config: this.getConfig()
    };
  }
}
