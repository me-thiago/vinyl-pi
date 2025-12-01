import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { eventBus, EventType } from '../utils/event-bus';
import { createSubscriptionManager, Destroyable, SubscriptionManager } from '../utils/lifecycle';
import { createLogger } from '../utils/logger';
import { AudioManager } from './audio-manager';
import { AudioAnalyzer } from './audio-analyzer';
import { EventDetector } from './event-detector';
import { SessionManager } from './session-manager';

const logger = createLogger('SocketManager');

/**
 * Dependências para o SocketManager
 */
export interface SocketManagerDependencies {
  audioManager: AudioManager;
  audioAnalyzer?: AudioAnalyzer;
  eventDetector?: EventDetector;
  sessionManager?: SessionManager;
}

/**
 * Formato do status enviado via WebSocket
 * (mesmo formato da API /api/status)
 */
interface StatusPayload {
  session: {
    id: string;
    started_at: string;
    duration: number;
    event_count: number;
  } | null;
  streaming: {
    active: boolean;
    listeners?: number;
    bitrate: number;
    mount_point: string;
  };
  audio: {
    level_db: number | null;
    clipping_detected: boolean;
    clipping_count: number;
    silence_detected: boolean;
  };
}

/**
 * Formato de evento enviado via WebSocket
 */
interface EventPayload {
  id: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  sessionId: string | null;
}

/**
 * SocketManager - Gerencia conexões WebSocket via Socket.io
 *
 * Features:
 * - Emite status updates a cada 5s para todos os clientes
 * - Emite eventos em tempo real quando detectados pelo EventBus
 * - Emite audio:level a cada 100ms para VU meter
 * - Suporta reconexão automática do cliente
 * - Graceful shutdown com cleanup de subscriptions
 *
 * Eventos emitidos:
 * - status:update - Status completo do sistema (a cada 5s)
 * - event:new - Novo evento detectado (tempo real)
 * - audio:level - Nível de áudio (a cada 100ms)
 * - session:started - Sessão iniciada
 * - session:ended - Sessão encerrada
 */
export class SocketManager implements Destroyable {
  private io: Server;
  private subscriptions: SubscriptionManager;
  private statusInterval: NodeJS.Timeout | null = null;
  private deps: SocketManagerDependencies;
  private eventCounter = 0;

  constructor(httpServer: HttpServer, deps: SocketManagerDependencies) {
    this.deps = deps;
    this.subscriptions = createSubscriptionManager();

    // Criar Socket.io server
    this.io = new Server(httpServer, {
      cors: {
        origin: true, // Aceita qualquer origem (rede local)
        credentials: true
      },
      // Configurações de reconexão do lado do servidor
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupConnectionHandlers();
    this.setupEventBusSubscriptions();
    this.startStatusBroadcast();

    logger.info('SocketManager inicializado');
  }

  /**
   * Configura handlers de conexão/desconexão
   */
  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('Cliente conectado', { socketId: socket.id });

      // Enviar status inicial imediatamente após conexão
      this.emitStatus(socket);

      // Handler de desconexão
      socket.on('disconnect', (reason) => {
        logger.info('Cliente desconectado', { socketId: socket.id, reason });
      });

      // Handler de erro
      socket.on('error', (error) => {
        logger.error('Erro no socket', { socketId: socket.id, error });
      });
    });
  }

  /**
   * Subscreve aos eventos do EventBus e emite via Socket.io
   */
  private setupEventBusSubscriptions(): void {
    // Eventos que devem ser emitidos para clientes
    const eventsToForward: EventType[] = [
      'silence.detected',
      'silence.ended',
      'clipping.detected',
      'session.started',
      'session.ended',
      'track.change.detected',
      'audio.start',
      'audio.stop'
    ];

    // Subscrever a cada evento
    eventsToForward.forEach((eventType) => {
      this.subscriptions.subscribe(eventType, async (payload) => {
        this.eventCounter++;

        const eventPayload: EventPayload = {
          id: `evt_${Date.now()}_${this.eventCounter}`,
          eventType,
          timestamp: new Date().toISOString(),
          metadata: payload,
          sessionId: this.deps.sessionManager?.getActiveSession()?.id || null
        };

        // Emitir evento para todos os clientes
        this.io.emit('event:new', eventPayload);

        // Eventos específicos de sessão
        if (eventType === 'session.started') {
          this.io.emit('session:started', {
            id: payload.sessionId,
            startedAt: payload.timestamp
          });
        } else if (eventType === 'session.ended') {
          this.io.emit('session:ended', {
            id: payload.sessionId,
            endedAt: payload.timestamp,
            durationSeconds: payload.durationSeconds,
            eventCount: payload.eventCount
          });
        }
      });
    });

    // Subscrever ao audio.level para VU meter (emitido a cada 100ms pelo AudioAnalyzer)
    this.subscriptions.subscribe('audio.level' as EventType, async (payload) => {
      // Só emitir se houver clientes conectados (otimização)
      if (this.io.engine.clientsCount > 0) {
        this.io.emit('audio:level', {
          levelDb: payload.levelDb,
          timestamp: payload.timestamp
        });
      }
    });
  }

  /**
   * Inicia broadcast de status a cada 5 segundos
   */
  private startStatusBroadcast(): void {
    this.statusInterval = setInterval(() => {
      // Só emitir se houver clientes conectados
      if (this.io.engine.clientsCount > 0) {
        this.emitStatus();
      }
    }, 5000);
  }

  /**
   * Emite status atual para um socket específico ou todos
   */
  private emitStatus(socket?: Socket): void {
    const status = this.buildStatusPayload();

    if (socket) {
      socket.emit('status:update', status);
    } else {
      this.io.emit('status:update', status);
    }
  }

  /**
   * Constrói payload de status (mesmo formato da API /api/status)
   */
  private buildStatusPayload(): StatusPayload {
    const { audioManager, audioAnalyzer, eventDetector, sessionManager } = this.deps;

    const streamingStatus = audioManager.getStreamingStatus();
    const levelDb = audioAnalyzer?.getCurrentLevelDb() ?? null;
    const silenceDetected = eventDetector?.getSilenceStatus() ?? false;
    const clippingCount = eventDetector?.getClippingCount() ?? 0;
    const activeSession = sessionManager?.getActiveSession();

    return {
      session: activeSession ? {
        id: activeSession.id,
        started_at: activeSession.startedAt.toISOString(),
        duration: activeSession.durationSeconds,
        event_count: activeSession.eventCount
      } : null,
      streaming: {
        active: streamingStatus.active,
        listeners: streamingStatus.listeners,
        bitrate: streamingStatus.bitrate,
        mount_point: streamingStatus.mountPoint
      },
      audio: {
        level_db: levelDb,
        clipping_detected: clippingCount > 0,
        clipping_count: clippingCount,
        silence_detected: silenceDetected
      }
    };
  }

  /**
   * Retorna número de clientes conectados
   */
  getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }

  /**
   * Retorna instância do Socket.io server (para testes)
   */
  getServer(): Server {
    return this.io;
  }

  /**
   * Cleanup: para interval e remove subscriptions
   */
  async destroy(): Promise<void> {
    logger.info('SocketManager encerrando...');

    // Parar broadcast de status
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }

    // Limpar subscriptions do EventBus
    this.subscriptions.cleanup();

    // Fechar todas as conexões
    this.io.close();

    logger.info('SocketManager parado');
  }
}
