/**
 * Auto-Recognition Service (V2-12)
 *
 * Gerencia reconhecimento automático de música no início de sessões de escuta.
 *
 * Quando uma sessão inicia e `autoOnSessionStart` está habilitado:
 * 1. Aguarda `autoDelay` segundos
 * 2. Dispara reconhecimento automático
 * 3. Salva track vinculado à sessão
 * 4. Emite WebSocket event `track_recognized`
 *
 * Se a sessão terminar antes do delay, o reconhecimento é cancelado.
 * Se já houve reconhecimento manual, o auto é ignorado.
 *
 * @module services/auto-recognition
 */

import { eventBus } from '../utils/event-bus';
import { createSubscriptionManager, Destroyable } from '../utils/lifecycle';
import { createLogger } from '../utils/logger';
import { recognize, isConfigured } from './recognition';
import { SettingsService } from './settings-service';
import { SocketManager } from './socket-manager';
import type { AudioManager } from './audio-manager';

const logger = createLogger('AutoRecognition');

/**
 * Dependências para o AutoRecognitionService
 */
export interface AutoRecognitionDeps {
  settingsService: SettingsService;
  audioManager: AudioManager;
  socketManager: SocketManager;
}

/**
 * AutoRecognitionService - Gerencia reconhecimento automático no início de sessões
 *
 * Fluxo:
 * ```
 * session.started → [autoEnabled?] → [delay] → [já reconheceu?] → recognize()
 *                          ↓                          ↓
 *                        (skip)                     (skip)
 * ```
 *
 * EventBus Safety:
 * - Usa createSubscriptionManager() para cleanup automático
 * - Implementa Destroyable interface
 */
export class AutoRecognitionService implements Destroyable {
  private subscriptions = createSubscriptionManager();
  private deps: AutoRecognitionDeps;
  private isRunning = false;

  // Timer pendente de reconhecimento
  private pendingTimer: NodeJS.Timeout | null = null;
  private pendingSessionId: string | null = null;

  // Rastreia se já houve reconhecimento na sessão atual
  private sessionHasRecognition = new Map<string, boolean>();

  constructor(deps: AutoRecognitionDeps) {
    this.deps = deps;
  }

  /**
   * Inicia o serviço de auto-reconhecimento
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('AutoRecognitionService já está rodando');
      return;
    }

    // Subscrever a eventos de sessão
    this.subscriptions.subscribe('session.started', this.handleSessionStarted.bind(this));
    this.subscriptions.subscribe('session.ended', this.handleSessionEnded.bind(this));

    // Subscrever a eventos de track reconhecido (para saber se já houve reconhecimento manual)
    this.subscriptions.subscribe('track.recognized', this.handleTrackRecognized.bind(this));

    this.isRunning = true;
    logger.info('AutoRecognitionService iniciado');
  }

  /**
   * Para o serviço e limpa recursos
   */
  async destroy(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    // Cancelar timer pendente
    this.cancelPendingRecognition();

    // Limpar subscriptions
    this.subscriptions.cleanup();

    // Limpar tracking
    this.sessionHasRecognition.clear();

    this.isRunning = false;
    logger.info('AutoRecognitionService parado');
  }

  /**
   * Handler para session.started
   * Agenda reconhecimento automático se habilitado
   */
  private async handleSessionStarted(payload: Record<string, unknown>): Promise<void> {
    const sessionId = payload.sessionId as string;

    logger.debug(`Sessão iniciada: ${sessionId}`);

    // Verificar se auto-reconhecimento está habilitado
    const autoEnabled = this.deps.settingsService.get<boolean>('recognition.autoOnSessionStart');
    if (!autoEnabled) {
      logger.debug('Auto-reconhecimento desabilitado, ignorando');
      return;
    }

    // Verificar se reconhecimento está configurado
    if (!isConfigured()) {
      logger.warn('Reconhecimento não configurado, ignorando auto-reconhecimento');
      return;
    }

    // Cancelar qualquer reconhecimento pendente anterior
    this.cancelPendingRecognition();

    // Marcar sessão como sem reconhecimento ainda
    this.sessionHasRecognition.set(sessionId, false);

    // Obter delay configurado
    const delay = this.deps.settingsService.get<number>('recognition.autoDelay');

    logger.info(`Agendando auto-reconhecimento em ${delay}s para sessão ${sessionId}`);

    // Agendar reconhecimento
    this.pendingSessionId = sessionId;
    this.pendingTimer = setTimeout(async () => {
      await this.executeAutoRecognition(sessionId);
    }, delay * 1000);
  }

  /**
   * Handler para session.ended
   * Cancela reconhecimento pendente se sessão terminar
   */
  private async handleSessionEnded(payload: Record<string, unknown>): Promise<void> {
    const sessionId = payload.sessionId as string;

    logger.debug(`Sessão encerrada: ${sessionId}`);

    // Cancelar se era a sessão pendente
    if (this.pendingSessionId === sessionId) {
      logger.info('Sessão encerrada antes do auto-reconhecimento, cancelando');
      this.cancelPendingRecognition();
    }

    // Limpar tracking da sessão
    this.sessionHasRecognition.delete(sessionId);
  }

  /**
   * Handler para track.recognized
   * Marca que já houve reconhecimento na sessão
   */
  private async handleTrackRecognized(payload: Record<string, unknown>): Promise<void> {
    const sessionId = payload.sessionId as string;

    if (sessionId) {
      logger.debug(`Track reconhecido na sessão ${sessionId}, marcando como já reconhecido`);
      this.sessionHasRecognition.set(sessionId, true);
    }
  }

  /**
   * Executa o reconhecimento automático
   */
  private async executeAutoRecognition(sessionId: string): Promise<void> {
    // Limpar referências do timer
    this.pendingTimer = null;
    this.pendingSessionId = null;

    // Verificar se já houve reconhecimento (manual ou outro auto)
    if (this.sessionHasRecognition.get(sessionId)) {
      logger.info('Já houve reconhecimento nesta sessão, ignorando auto');
      return;
    }

    logger.info(`Executando auto-reconhecimento para sessão ${sessionId}`);

    try {
      // Emitir evento de início (para UI mostrar "Identificando...")
      this.deps.socketManager.getServer().emit('recognition_started', {
        sessionId,
        auto: true,
        timestamp: new Date().toISOString(),
      });

      // Obter duração do sample configurada
      const sampleDuration = this.deps.settingsService.get<number>('recognition.sampleDuration');

      // Executar reconhecimento
      const result = await recognize({
        trigger: 'automatic',
        sampleDuration,
        sessionId,
        audioManager: this.deps.audioManager,
      });

      if (result.success) {
        // Marcar como reconhecido
        this.sessionHasRecognition.set(sessionId, true);
        logger.info(`Auto-reconhecimento bem-sucedido: "${result.track?.title}" - ${result.track?.artist}`);
        // track_recognized já é emitido pelo recognize()
      } else {
        logger.warn(`Auto-reconhecimento falhou: ${result.error}`);
        // Não afeta a sessão, apenas loga
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Erro no auto-reconhecimento: ${errorMsg}`);
      // Não afeta a sessão
    }
  }

  /**
   * Cancela reconhecimento pendente
   */
  private cancelPendingRecognition(): void {
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.pendingSessionId = null;
  }

  /**
   * Retorna status do serviço
   */
  getStatus(): {
    isRunning: boolean;
    hasPendingRecognition: boolean;
    pendingSessionId: string | null;
  } {
    return {
      isRunning: this.isRunning,
      hasPendingRecognition: this.pendingTimer !== null,
      pendingSessionId: this.pendingSessionId,
    };
  }
}

