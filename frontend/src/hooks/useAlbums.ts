import { useState, useCallback, useEffect } from 'react';

/**
 * Formato físico do disco
 */
export type AlbumFormat = 'LP' | 'EP' | 'SINGLE_7' | 'SINGLE_12' | 'DOUBLE_LP' | 'BOX_SET';

/**
 * Condição física do disco (Goldmine Standard)
 */
export type AlbumCondition = 'mint' | 'near_mint' | 'vg_plus' | 'vg' | 'good' | 'fair' | 'poor';

/**
 * Álbum da coleção
 */
export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  label: string | null;
  format: AlbumFormat | null;
  coverUrl: string | null;
  discogsId: number | null;
  discogsAvailable: boolean;
  condition: AlbumCondition | null;
  tags: string[] | null;
  notes: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input para criar álbum
 */
export interface AlbumCreateInput {
  title: string;
  artist: string;
  year?: number | null;
  label?: string | null;
  format?: AlbumFormat | null;
  coverUrl?: string | null;
  discogsId?: number | null;
  condition?: AlbumCondition | null;
  tags?: string[] | null;
  notes?: string | null;
}

/**
 * Input para atualizar álbum
 */
export interface AlbumUpdateInput {
  title?: string;
  artist?: string;
  year?: number | null;
  label?: string | null;
  format?: AlbumFormat | null;
  coverUrl?: string | null;
  condition?: AlbumCondition | null;
  tags?: string[] | null;
  notes?: string | null;
}

/**
 * Filtros para busca de álbuns
 */
export interface AlbumFilters {
  search?: string;
  artist?: string;
  year?: number;
  format?: AlbumFormat;
  condition?: AlbumCondition;
  archived?: boolean;
  sort?: 'title' | 'artist' | 'year' | 'createdAt';
  order?: 'asc' | 'desc';
}

/**
 * Resposta de listagem
 */
interface AlbumsListResponse {
  data: Album[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Resposta de álbum individual
 */
interface AlbumResponse {
  data: Album;
}

/**
 * Erro da API
 */
interface ApiError {
  error: {
    message: string;
    code: string;
  };
}

// URL base da API
const API_HOST = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3001`;

/**
 * Hook para gerenciamento de álbuns da coleção (V2)
 *
 * Fornece:
 * - CRUD completo de álbuns
 * - Busca com filtros e paginação
 * - Estado de loading e erro
 * - Infinite scroll via loadMore
 */
export function useAlbums(initialFilters?: AlbumFilters) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AlbumFilters>(initialFilters ?? {});
  const [offset, setOffset] = useState(0);
  const limit = 20;

  /**
   * Busca álbuns com filtros
   */
  const fetchAlbums = useCallback(async (newOffset = 0, append = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(newOffset));

      if (filters.search) params.set('search', filters.search);
      if (filters.artist) params.set('artist', filters.artist);
      if (filters.year) params.set('year', String(filters.year));
      if (filters.format) params.set('format', filters.format);
      if (filters.archived !== undefined) params.set('archived', String(filters.archived));
      if (filters.sort) params.set('sort', filters.sort);
      if (filters.order) params.set('order', filters.order);

      const response = await fetch(`${API_HOST}/api/albums?${params.toString()}`);

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao buscar álbuns');
      }

      const data = (await response.json()) as AlbumsListResponse;

      if (append) {
        setAlbums((prev) => [...prev, ...data.data]);
      } else {
        setAlbums(data.data);
      }
      setTotal(data.meta.total);
      setOffset(newOffset);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters, limit]);

  /**
   * Carrega mais álbuns (infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (loading || albums.length >= total) return;
    fetchAlbums(offset + limit, true);
  }, [fetchAlbums, loading, albums.length, total, offset, limit]);

  /**
   * Atualiza filtros e recarrega
   */
  const updateFilters = useCallback((newFilters: AlbumFilters) => {
    setFilters(newFilters);
    setOffset(0);
  }, []);

  /**
   * Busca álbum por ID
   */
  const getAlbum = useCallback(async (id: string): Promise<Album | null> => {
    try {
      const response = await fetch(`${API_HOST}/api/albums/${id}`);

      if (!response.ok) {
        if (response.status === 404) return null;
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao buscar álbum');
      }

      const data = (await response.json()) as AlbumResponse;
      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return null;
    }
  }, []);

  /**
   * Cria novo álbum
   */
  const createAlbum = useCallback(async (input: AlbumCreateInput): Promise<Album | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_HOST}/api/albums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao criar álbum');
      }

      const data = (await response.json()) as AlbumResponse;

      // Adiciona ao início da lista
      setAlbums((prev) => [data.data, ...prev]);
      setTotal((prev) => prev + 1);

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualiza álbum existente
   */
  const updateAlbum = useCallback(async (id: string, input: AlbumUpdateInput): Promise<Album | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_HOST}/api/albums/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao atualizar álbum');
      }

      const data = (await response.json()) as AlbumResponse;

      // Atualiza na lista
      setAlbums((prev) => prev.map((a) => (a.id === id ? data.data : a)));

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Deleta álbum
   */
  const deleteAlbum = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_HOST}/api/albums/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao deletar álbum');
      }

      // Remove da lista
      setAlbums((prev) => prev.filter((a) => a.id !== id));
      setTotal((prev) => prev - 1);

      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Arquiva ou desarquiva álbum
   */
  const archiveAlbum = useCallback(async (id: string, archived: boolean): Promise<Album | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_HOST}/api/albums/${id}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao arquivar álbum');
      }

      const data = (await response.json()) as AlbumResponse;

      // Se filtrando por archived=false e arquivou, remove da lista
      if (!filters.archived && archived) {
        setAlbums((prev) => prev.filter((a) => a.id !== id));
        setTotal((prev) => prev - 1);
      } else {
        // Atualiza na lista
        setAlbums((prev) => prev.map((a) => (a.id === id ? data.data : a)));
      }

      return data.data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters.archived]);

  /**
   * Recarrega a lista
   */
  const refresh = useCallback(() => {
    setOffset(0);
    fetchAlbums(0, false);
  }, [fetchAlbums]);

  /**
   * Limpa erro
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Carrega álbuns quando filtros mudam
  useEffect(() => {
    fetchAlbums(0, false);
  }, [fetchAlbums]);

  return {
    // Estado
    albums,
    total,
    loading,
    error,
    filters,
    hasMore: albums.length < total,

    // Ações de busca
    updateFilters,
    loadMore,
    refresh,
    clearError,

    // CRUD
    getAlbum,
    createAlbum,
    updateAlbum,
    deleteAlbum,
    archiveAlbum,
  };
}

/**
 * Hook para buscar um álbum específico por ID
 */
export function useAlbum(id: string | undefined) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlbum = useCallback(async () => {
    if (!id) {
      setAlbum(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_HOST}/api/albums/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          setAlbum(null);
          setError('Álbum não encontrado');
          return;
        }
        const errorData = (await response.json()) as ApiError;
        throw new Error(errorData.error?.message || 'Erro ao buscar álbum');
      }

      const data = (await response.json()) as AlbumResponse;
      setAlbum(data.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      setAlbum(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAlbum();
  }, [fetchAlbum]);

  return {
    album,
    loading,
    error,
    refresh: fetchAlbum,
  };
}
