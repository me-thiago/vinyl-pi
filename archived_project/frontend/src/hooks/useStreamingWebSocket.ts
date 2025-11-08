import { useEffect, useRef, useState, useCallback } from 'react';

interface StreamingConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
  bufferSize?: number;
  initialDelay?: number;
}

interface StreamingStatus {
  connected: boolean;
  streaming: boolean;
  latency: number;
  clients: number;
  error: string | null;
}

interface AudioMessage {
  type: 'audio' | 'status' | 'connected';
  data?: string; // base64 encoded PCM
  timestamp?: number;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  streaming?: boolean;
  clients?: number;
  latency?: number;
  message?: string;
  config?: StreamingConfig;
}

export function useStreamingWebSocket(url: string) {
  const [status, setStatus] = useState<StreamingStatus>({
    connected: false,
    streaming: false,
    latency: 0,
    clients: 0,
    error: null
  });

  const [config, setConfig] = useState<StreamingConfig>({
    sampleRate: 48000,
    channels: 2,
    bitDepth: 16,
    bufferSize: 20,
    initialDelay: 500
  });

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 10;

  // Callbacks para eventos de áudio
  const onAudioDataRef = useRef<((data: Float32Array) => void) | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected');
      return;
    }

    console.log('Connecting to streaming WebSocket:', url);

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to streaming');
        reconnectAttemptsRef.current = 0;
        setStatus(prev => ({
          ...prev,
          connected: true,
          error: null
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: AudioMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'connected':
              console.log('Streaming connection confirmed:', message.message);
              if (message.config) {
                setConfig(message.config);
              }
              break;

            case 'audio':
              // Decodificar PCM de base64
              if (message.data && onAudioDataRef.current) {
                const binaryString = atob(message.data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }

                // Converter para Float32Array
                const int16Array = new Int16Array(bytes.buffer);
                const float32Array = new Float32Array(int16Array.length);
                for (let i = 0; i < int16Array.length; i++) {
                  float32Array[i] = int16Array[i] / 32768.0; // Normalizar para -1 a 1
                }

                // Enviar para callback
                onAudioDataRef.current(float32Array);

                // Marcar como streaming
                setStatus(prev => ({
                  ...prev,
                  streaming: true
                }));
              }
              break;

            case 'status':
              setStatus(prev => ({
                ...prev,
                streaming: message.streaming ?? prev.streaming,
                clients: message.clients ?? prev.clients,
                latency: message.latency ?? prev.latency
              }));
              break;

            default:
              console.log('Unknown message type:', message);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setStatus(prev => ({
          ...prev,
          error: 'Connection error'
        }));
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setStatus(prev => ({
          ...prev,
          connected: false,
          streaming: false
        }));

        // Tentar reconectar
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          setStatus(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached'
          }));
        }
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setStatus(prev => ({
        ...prev,
        error: 'Failed to create connection'
      }));
    }
  }, [url]);

  const disconnect = useCallback(() => {
    console.log('Disconnecting WebSocket');

    // Cancelar reconexão pendente
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Fechar WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Fechar AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setStatus({
      connected: false,
      streaming: false,
      latency: 0,
      clients: 0,
      error: null
    });
  }, []);

  const onAudioData = useCallback((callback: (data: Float32Array) => void) => {
    onAudioDataRef.current = callback;
  }, []);

  const updateLatency = useCallback((latencyMs: number) => {
    setStatus(prev => ({
      ...prev,
      latency: latencyMs
    }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    config,
    connect,
    disconnect,
    onAudioData,
    updateLatency,
    isConnected: status.connected,
    isStreaming: status.streaming
  };
}
