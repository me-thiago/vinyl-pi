import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Formato do status recebido via WebSocket
 */
export interface StatusPayload {
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
 * Formato de evento recebido via WebSocket
 */
export interface EventPayload {
  id: string;
  eventType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  sessionId: string | null;
}

/**
 * Payload de nível de áudio (para VU meter)
 */
export interface AudioLevelPayload {
  levelDb: number;
  timestamp: string;
}

/**
 * Estado da conexão WebSocket
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Callbacks para eventos do socket
 */
export interface SocketCallbacks {
  onStatus?: (status: StatusPayload) => void;
  onEvent?: (event: EventPayload) => void;
  onAudioLevel?: (level: AudioLevelPayload) => void;
  onSessionStarted?: (data: { id: string; startedAt: string }) => void;
  onSessionEnded?: (data: { id: string; endedAt: string; durationSeconds: number; eventCount: number }) => void;
}

/**
 * Retorno do hook useSocket
 */
export interface UseSocketReturn {
  /** Estado atual da conexão */
  connectionState: ConnectionState;
  /** Se está conectado ao servidor */
  isConnected: boolean;
  /** Último status recebido */
  status: StatusPayload | null;
  /** Último evento recebido */
  lastEvent: EventPayload | null;
  /** Último nível de áudio recebido */
  audioLevel: number | null;
  /** Reconectar manualmente */
  reconnect: () => void;
  /** Desconectar */
  disconnect: () => void;
}

// URL do servidor Socket.io
const SOCKET_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

/**
 * Hook para conexão WebSocket com o backend
 *
 * Fornece:
 * - Conexão automática com reconexão
 * - Estado de conexão reativo
 * - Callbacks para status, eventos e nível de áudio
 * - Último status e evento recebidos
 *
 * @param callbacks Callbacks opcionais para eventos
 * @returns Estado da conexão e dados recebidos
 */
export function useSocket(callbacks?: SocketCallbacks): UseSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [lastEvent, setLastEvent] = useState<EventPayload | null>(null);
  const [audioLevel, setAudioLevel] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const callbacksRef = useRef(callbacks);

  // Atualizar ref de callbacks quando mudam
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  // Conectar ao socket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    setConnectionState('connecting');

    const socket = io(SOCKET_URL, {
      // Reconexão automática
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      // Timeout de conexão
      timeout: 20000,
      // Transports - preferir websocket
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    // Handlers de conexão
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected');
      setConnectionState('connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setConnectionState('disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setConnectionState('error');
    });

    // Handler de status
    socket.on('status:update', (data: StatusPayload) => {
      setStatus(data);
      callbacksRef.current?.onStatus?.(data);
    });

    // Handler de novos eventos
    socket.on('event:new', (data: EventPayload) => {
      setLastEvent(data);
      callbacksRef.current?.onEvent?.(data);
    });

    // Handler de nível de áudio
    socket.on('audio:level', (data: AudioLevelPayload) => {
      setAudioLevel(data.levelDb);
      callbacksRef.current?.onAudioLevel?.(data);
    });

    // Handler de sessão iniciada
    socket.on('session:started', (data: { id: string; startedAt: string }) => {
      callbacksRef.current?.onSessionStarted?.(data);
    });

    // Handler de sessão encerrada
    socket.on('session:ended', (data: { id: string; endedAt: string; durationSeconds: number; eventCount: number }) => {
      callbacksRef.current?.onSessionEnded?.(data);
    });
  }, []);

  // Desconectar
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectionState('disconnected');
    }
  }, []);

  // Reconectar manualmente
  const reconnect = useCallback(() => {
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Conectar no mount, desconectar no unmount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    status,
    lastEvent,
    audioLevel,
    reconnect,
    disconnect
  };
}
