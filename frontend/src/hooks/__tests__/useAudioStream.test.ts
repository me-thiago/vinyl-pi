import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudioStream } from '../useAudioStream';

// Mock fetch
global.fetch = vi.fn();

describe('useAudioStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve inicializar com estado padrão', () => {
    const { result } = renderHook(() =>
      useAudioStream({
        streamUrl: 'http://localhost:8000/stream',
      })
    );

    expect(result.current.playing).toBe(false);
    expect(result.current.buffering).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.volume).toBe(1.0);
    expect(result.current.latency).toBe(0);
  });

  it('deve verificar suporte Web Audio API', () => {
    const { result } = renderHook(() =>
      useAudioStream({
        streamUrl: 'http://localhost:8000/stream',
      })
    );

    expect(result.current.webAudioSupported).toBe(true);
  });

  it('deve atualizar volume corretamente', () => {
    const { result } = renderHook(() =>
      useAudioStream({
        streamUrl: 'http://localhost:8000/stream',
      })
    );

    act(() => {
      result.current.setVolume(0.5);
    });

    expect(result.current.volume).toBe(0.5);
  });

  it('deve limitar volume entre 0 e 1', () => {
    const { result } = renderHook(() =>
      useAudioStream({
        streamUrl: 'http://localhost:8000/stream',
      })
    );

    act(() => {
      result.current.setVolume(-0.5);
    });
    expect(result.current.volume).toBe(0);

    act(() => {
      result.current.setVolume(1.5);
    });
    expect(result.current.volume).toBe(1);
  });

  it('deve tratar erro de conexão corretamente', async () => {
    const onError = vi.fn();
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection failed'));

    global.fetch = mockFetch;

    const { result } = renderHook(() =>
      useAudioStream({
        streamUrl: 'http://localhost:8000/stream',
        onError,
      })
    );

    await act(async () => {
      try {
        await result.current.startStream();
      } catch (e) {
        // Esperado - erro será tratado internamente
      }
    });

    // Verificar que o estado de erro foi setado ou onError foi chamado
    await waitFor(() => {
      const hasError = result.current.error !== null || onError.mock.calls.length > 0;
      expect(hasError).toBe(true);
    }, { timeout: 2000 });
  });
});

