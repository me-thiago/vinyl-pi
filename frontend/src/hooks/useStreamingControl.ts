import { useState, useCallback } from 'react';

interface StreamingStatus {
  active: boolean;
  bitrate: number;
  mountPoint: string;
  listeners?: number;
  error?: string;
}

interface UseStreamingControlReturn {
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  streamingStatus: StreamingStatus | null;
  startStreaming: () => Promise<void>;
  stopStreaming: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useStreamingControl(): UseStreamingControlReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/streaming/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch streaming status');
      }
      const data = await response.json();
      setStreamingStatus(data);
      setIsStreaming(data.active);
    } catch (err) {
      console.error('Error fetching streaming status:', err);
      // Não seta erro aqui para não atrapalhar UI
    }
  }, []);

  const startStreaming = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/streaming/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start streaming');
      }

      const data = await response.json();
      console.log('Streaming started:', data);
      
      setIsStreaming(true);
      await refreshStatus();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error starting streaming:', err);
    } finally {
      setIsLoading(false);
    }
  }, [refreshStatus]);

  const stopStreaming = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/streaming/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to stop streaming');
      }

      const data = await response.json();
      console.log('Streaming stopped:', data);
      
      setIsStreaming(false);
      setStreamingStatus(null);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error stopping streaming:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isStreaming,
    isLoading,
    error,
    streamingStatus,
    startStreaming,
    stopStreaming,
    refreshStatus,
  };
}

