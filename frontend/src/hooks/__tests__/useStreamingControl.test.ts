import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStreamingControl } from '../useStreamingControl';

// Mock fetch
const mockFetch = vi.fn();
(globalThis as unknown as { fetch: typeof mockFetch }).fetch = mockFetch;

describe('useStreamingControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve inicializar com estado padrão', () => {
    const { result } = renderHook(() => useStreamingControl());

    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.streamingStatus).toBeNull();
  });

  it('deve expor as funções necessárias', () => {
    const { result } = renderHook(() => useStreamingControl());

    expect(typeof result.current.startStreaming).toBe('function');
    expect(typeof result.current.stopStreaming).toBe('function');
    expect(typeof result.current.refreshStatus).toBe('function');
  });

  describe('refreshStatus', () => {
    it('deve buscar e atualizar o status do streaming', async () => {
      const mockStatus = {
        active: true,
        bitrate: 192,
        mountPoint: '/stream',
        listeners: 3,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockStatus),
      });

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.refreshStatus();
      });

      expect(result.current.streamingStatus).toEqual(mockStatus);
      expect(result.current.isStreaming).toBe(true);
    });

    it('deve tratar erro silenciosamente em refreshStatus', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useStreamingControl());

      // Não deve lançar erro
      await act(async () => {
        await result.current.refreshStatus();
      });

      // Erro não deve ser setado (para não atrapalhar UI)
      expect(result.current.error).toBeNull();
    });

    it('deve tratar resposta não-ok em refreshStatus', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.refreshStatus();
      });

      // Não deve setar erro visível
      expect(result.current.error).toBeNull();
    });
  });

  describe('startStreaming', () => {
    it('deve iniciar streaming com sucesso', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ active: true, bitrate: 128, mountPoint: '/stream' }),
        });

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.startStreaming();
      });

      expect(result.current.isStreaming).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('deve setar isLoading durante startStreaming', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useStreamingControl());

      // Iniciar a operação
      act(() => {
        result.current.startStreaming();
      });

      // Verificar loading state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolver a promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('deve tratar erro ao iniciar streaming', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Stream already running' }),
      });

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.startStreaming();
      });

      expect(result.current.error).toBe('Stream already running');
      expect(result.current.isLoading).toBe(false);
    });

    it('deve tratar erro de rede ao iniciar streaming', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.startStreaming();
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('stopStreaming', () => {
    it('deve parar streaming com sucesso', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() => useStreamingControl());

      // Simular estado de streaming ativo
      await act(async () => {
        await result.current.stopStreaming();
      });

      expect(result.current.isStreaming).toBe(false);
      expect(result.current.streamingStatus).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('deve setar isLoading durante stopStreaming', async () => {
      let resolvePromise: (value: unknown) => void;
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const { result } = renderHook(() => useStreamingControl());

      act(() => {
        result.current.stopStreaming();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
    });

    it('deve tratar erro ao parar streaming', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Stream not running' }),
      });

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.stopStreaming();
      });

      expect(result.current.error).toBe('Stream not running');
      expect(result.current.isLoading).toBe(false);
    });

    it('deve tratar erro de rede ao parar streaming', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const { result } = renderHook(() => useStreamingControl());

      await act(async () => {
        await result.current.stopStreaming();
      });

      expect(result.current.error).toBe('Connection refused');
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('startStreaming deve limpar erro anterior', async () => {
    // Primeiro, provocar um erro
    mockFetch.mockRejectedValueOnce(new Error('First error'));

    const { result } = renderHook(() => useStreamingControl());

    await act(async () => {
      await result.current.startStreaming();
    });

    expect(result.current.error).toBe('First error');

    // Agora chamar startStreaming novamente
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ active: true }),
    });

    await act(async () => {
      await result.current.startStreaming();
    });

    expect(result.current.error).toBeNull();
  });

  it('stopStreaming deve limpar erro anterior', async () => {
    mockFetch.mockRejectedValueOnce(new Error('First error'));

    const { result } = renderHook(() => useStreamingControl());

    await act(async () => {
      await result.current.stopStreaming();
    });

    expect(result.current.error).toBe('First error');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await act(async () => {
      await result.current.stopStreaming();
    });

    expect(result.current.error).toBeNull();
  });
});
