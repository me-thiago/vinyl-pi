import { useState, useEffect, useCallback } from 'react';

/**
 * Recording progress data durante gravação ativa
 */
export interface RecordingProgress {
  id: string;
  startedAt: Date;
  durationSeconds: number;
  fileSizeBytes?: number;
}

/**
 * Hook para controle de gravação FLAC
 * 
 * Features:
 * - Iniciar/parar gravação
 * - Status em tempo real via polling
 * - Integração com WebSocket (futuro)
 * 
 * @example
 * ```tsx
 * const { isRecording, startRecording, stopRecording } = useRecording();
 * 
 * <Button onClick={() => startRecording()}>
 *   {isRecording ? 'Stop' : 'Record'}
 * </Button>
 * ```
 */
export function useRecording() {
  const [isRecording, setIsRecording] = useState(false);
  const [currentRecording, setCurrentRecording] = useState<RecordingProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

  /**
   * Buscar status atual da gravação
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/api/recordings/status`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch recording status: ${response.status}`);
      }

      const result = await response.json();
      const { isRecording: recording, currentRecording: current } = result.data;

      setIsRecording(recording);
      
      if (current) {
        setCurrentRecording({
          id: current.id,
          startedAt: new Date(current.startedAt),
          durationSeconds: current.durationSeconds || 0,
          fileSizeBytes: current.fileSizeBytes,
        });
      } else {
        setCurrentRecording(null);
      }
    } catch (err) {
      console.error('Error fetching recording status:', err);
      // Não seta error aqui para evitar poluir UI com erros de polling
    }
  }, [apiUrl]);

  /**
   * Iniciar nova gravação
   * 
   * @param albumId - Opcional: vincular gravação a álbum
   * @param fileName - Opcional: nome customizado
   */
  const startRecording = useCallback(async (albumId?: string, fileName?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/recordings/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ albumId, fileName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to start recording');
      }

      const result = await response.json();
      const recording = result.data;

      setIsRecording(true);
      setCurrentRecording({
        id: recording.id,
        startedAt: new Date(recording.startedAt),
        durationSeconds: 0,
      });

      return recording;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start recording';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  /**
   * Parar gravação ativa
   */
  const stopRecording = useCallback(async () => {
    if (!currentRecording) {
      throw new Error('No active recording to stop');
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/recordings/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordingId: currentRecording.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to stop recording');
      }

      const result = await response.json();
      const recording = result.data;

      setIsRecording(false);
      setCurrentRecording(null);

      return recording;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, currentRecording]);

  /**
   * Polling de status a cada 2s quando gravando
   */
  useEffect(() => {
    // Buscar status inicial
    fetchStatus();

    // Setup polling apenas se gravando
    if (isRecording) {
      const interval = setInterval(fetchStatus, 2000);
      return () => clearInterval(interval);
    }
  }, [isRecording, fetchStatus]);

  return {
    isRecording,
    currentRecording,
    startRecording,
    stopRecording,
    error,
    isLoading,
  };
}
