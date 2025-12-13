/**
 * useRecognition Hook (V2-07)
 *
 * Hook para reconhecimento musical via API.
 * Gerencia estados de loading/error e fornece métodos para
 * trigger de reconhecimento e confirmação de match.
 */

import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

/**
 * Match individual de álbum
 */
export interface AlbumMatchItem {
  albumId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  confidence: number;
}

/**
 * Resultado de match de álbum (com todos os matches)
 */
export interface AlbumMatchResult {
  albumId: string;
  albumTitle: string;
  matchConfidence: number;
  needsConfirmation: boolean;
  matches: AlbumMatchItem[];
}

/**
 * Track reconhecido
 */
export interface RecognizedTrack {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  albumArt: string | null;
  year: number | null;
  durationSeconds: number | null;
  confidence: number;
  source: string;
  albumMatch: AlbumMatchResult | null;
}

/**
 * Resultado do reconhecimento
 */
export interface RecognitionResult {
  success: boolean;
  track?: RecognizedTrack;
  error?: string;
  errorCode?: string;
}

/**
 * Retorno do hook useRecognition
 */
export interface UseRecognitionReturn {
  /** Inicia reconhecimento manual */
  recognize: () => Promise<RecognitionResult>;
  /** Confirma vínculo de track com álbum */
  confirm: (trackId: string, albumId: string | null) => Promise<void>;
  /** Indica se está em processo de reconhecimento */
  isRecognizing: boolean;
  /** Indica se está confirmando vínculo */
  isConfirming: boolean;
  /** Último resultado de reconhecimento */
  lastResult: RecognitionResult | null;
  /** Erro atual */
  error: string | null;
  /** Limpa o último resultado e erro */
  reset: () => void;
}

/**
 * Hook para reconhecimento musical
 */
export function useRecognition(): UseRecognitionReturn {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [lastResult, setLastResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Inicia reconhecimento manual
   */
  const recognize = useCallback(async (): Promise<RecognitionResult> => {
    setIsRecognizing(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(`${API_URL}/api/recognize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: 'manual' }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error?.message || `HTTP ${response.status}`;
        const result: RecognitionResult = {
          success: false,
          error: errorMessage,
          errorCode: errorData?.error?.code || 'HTTP_ERROR',
        };
        setLastResult(result);
        setError(errorMessage);
        return result;
      }

      const data = await response.json();
      
      // A API pode retornar success: false com error
      if (!data.success) {
        const result: RecognitionResult = {
          success: false,
          error: data.error || 'Música não identificada',
          errorCode: data.errorCode,
        };
        setLastResult(result);
        // Não consideramos "NOT_FOUND" como erro de UI
        if (data.errorCode !== 'NOT_FOUND') {
          setError(data.error);
        }
        return result;
      }

      const result: RecognitionResult = {
        success: true,
        track: data.track,
      };
      setLastResult(result);
      return result;
    } catch (err) {
      let errorMessage = 'Erro ao identificar música';
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'Timeout - tente novamente';
        } else {
          errorMessage = err.message;
        }
      }

      const result: RecognitionResult = {
        success: false,
        error: errorMessage,
        errorCode: 'NETWORK_ERROR',
      };
      setLastResult(result);
      setError(errorMessage);
      return result;
    } finally {
      setIsRecognizing(false);
    }
  }, []);

  /**
   * Confirma vínculo de track com álbum
   */
  const confirm = useCallback(async (trackId: string, albumId: string | null): Promise<void> => {
    setIsConfirming(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/recognize/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackId, albumId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || `HTTP ${response.status}`);
      }

      // Atualiza o lastResult com o albumId confirmado
      if (lastResult?.track) {
        setLastResult({
          ...lastResult,
          track: {
            ...lastResult.track,
            albumMatch: lastResult.track.albumMatch
              ? { ...lastResult.track.albumMatch, albumId: albumId || '' }
              : null,
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao confirmar vínculo';
      setError(errorMessage);
      throw err;
    } finally {
      setIsConfirming(false);
    }
  }, [lastResult]);

  /**
   * Limpa o último resultado e erro
   */
  const reset = useCallback(() => {
    setLastResult(null);
    setError(null);
  }, []);

  return {
    recognize,
    confirm,
    isRecognizing,
    isConfirming,
    lastResult,
    error,
    reset,
  };
}
