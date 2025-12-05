import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAlbums, useAlbum } from '../useAlbums';
import type { Album } from '../useAlbums';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock album data
const mockAlbum: Album = {
  id: 'album-1',
  title: 'Abbey Road',
  artist: 'The Beatles',
  year: 1969,
  label: 'Apple Records',
  format: 'LP',
  coverUrl: 'https://example.com/cover.jpg',
  discogsId: 12345,
  discogsAvailable: true,
  condition: 'vg_plus',
  tags: ['rock', '60s'],
  notes: 'Original pressing',
  archived: false,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockAlbum2: Album = {
  id: 'album-2',
  title: 'Dark Side of the Moon',
  artist: 'Pink Floyd',
  year: 1973,
  label: 'Harvest',
  format: 'LP',
  coverUrl: null,
  discogsId: null,
  discogsAvailable: true,
  condition: 'mint',
  tags: ['progressive', '70s'],
  notes: null,
  archived: false,
  createdAt: '2024-01-02T00:00:00.000Z',
  updatedAt: '2024-01-02T00:00:00.000Z',
};

describe('useAlbums', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('deve inicializar com lista vazia', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [], meta: { total: 0, limit: 20, offset: 0 } }),
    });

    const { result } = renderHook(() => useAlbums());

    expect(result.current.albums).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('deve buscar álbuns na inicialização', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [mockAlbum, mockAlbum2],
        meta: { total: 2, limit: 20, offset: 0 },
      }),
    });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.albums).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('deve aplicar filtros corretamente', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [mockAlbum],
        meta: { total: 1, limit: 20, offset: 0 },
      }),
    });

    const { result } = renderHook(() => useAlbums({ search: 'Beatles' }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verificar que a URL inclui o parâmetro de busca
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('search=Beatles')
    );
  });

  it('deve atualizar filtros e recarregar', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [mockAlbum],
        meta: { total: 1, limit: 20, offset: 0 },
      }),
    });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [mockAlbum2],
        meta: { total: 1, limit: 20, offset: 0 },
      }),
    });

    act(() => {
      result.current.updateFilters({ format: 'LP' });
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('format=LP')
      );
    });
  });

  it('deve criar álbum corretamente', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], meta: { total: 0, limit: 20, offset: 0 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockAlbum }),
      });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let createdAlbum: Album | null = null;
    await act(async () => {
      createdAlbum = await result.current.createAlbum({
        title: 'Abbey Road',
        artist: 'The Beatles',
      });
    });

    expect(createdAlbum).toEqual(mockAlbum);
    expect(result.current.albums).toContainEqual(mockAlbum);
    expect(result.current.total).toBe(1);
  });

  it('deve atualizar álbum corretamente', async () => {
    const updatedAlbum = { ...mockAlbum, notes: 'Updated notes' };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [mockAlbum],
          meta: { total: 1, limit: 20, offset: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: updatedAlbum }),
      });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateAlbum('album-1', { notes: 'Updated notes' });
    });

    expect(result.current.albums[0].notes).toBe('Updated notes');
  });

  it('deve deletar álbum corretamente', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [mockAlbum, mockAlbum2],
          meta: { total: 2, limit: 20, offset: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteAlbum('album-1');
    });

    expect(result.current.albums).toHaveLength(1);
    expect(result.current.albums[0].id).toBe('album-2');
    expect(result.current.total).toBe(1);
  });

  it('deve arquivar álbum corretamente', async () => {
    const archivedAlbum = { ...mockAlbum, archived: true };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: [mockAlbum],
          meta: { total: 1, limit: 20, offset: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: archivedAlbum }),
      });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.archiveAlbum('album-1', true);
    });

    // Sem filtro archived, o álbum arquivado é removido da lista
    expect(result.current.albums).toHaveLength(0);
  });

  it('deve lidar com erro na busca', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: { message: 'Erro ao buscar álbuns', code: 'ALBUMS_FETCH_ERROR' },
      }),
    });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Erro ao buscar álbuns');
  });

  it('deve limpar erro', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({
        error: { message: 'Erro', code: 'ERROR' },
      }),
    });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('deve carregar mais álbuns (load more)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: Array(20).fill(mockAlbum).map((a, i) => ({ ...a, id: `album-${i}` })),
          meta: { total: 40, limit: 20, offset: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: Array(20).fill(mockAlbum2).map((a, i) => ({ ...a, id: `album-${i + 20}` })),
          meta: { total: 40, limit: 20, offset: 20 },
        }),
      });

    const { result } = renderHook(() => useAlbums());

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(20);
      expect(result.current.hasMore).toBe(true);
    });

    await act(async () => {
      result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.albums).toHaveLength(40);
      expect(result.current.hasMore).toBe(false);
    });
  });
});

describe('useAlbum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('deve buscar álbum por ID', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockAlbum }),
    });

    const { result } = renderHook(() => useAlbum('album-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.album).toEqual(mockAlbum);
    expect(result.current.error).toBeNull();
  });

  it('deve retornar null para álbum não encontrado', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({
        error: { message: 'Álbum não encontrado', code: 'ALBUM_NOT_FOUND' },
      }),
    });

    const { result } = renderHook(() => useAlbum('nonexistent'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.album).toBeNull();
    expect(result.current.error).toBe('Álbum não encontrado');
  });

  it('deve permitir refresh', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockAlbum }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { ...mockAlbum, notes: 'Updated' } }),
      });

    const { result } = renderHook(() => useAlbum('album-1'));

    await waitFor(() => {
      expect(result.current.album?.notes).toBe('Original pressing');
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.album?.notes).toBe('Updated');
    });
  });

  it('deve retornar null se ID não fornecido', () => {
    const { result } = renderHook(() => useAlbum(undefined));

    expect(result.current.album).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
