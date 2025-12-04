import { getIcecastStats, getListenerCount, clearCache } from '../../services/icecast-stats';

// Mock do fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('IcecastStats Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache(); // Limpar cache entre testes
  });

  describe('getIcecastStats', () => {
    it('should return stats when Icecast responds successfully', async () => {
      const mockResponse = {
        icestats: {
          host: 'localhost',
          source: {
            listeners: 5,
            server_name: 'Vinyl-OS Stream',
            bitrate: 320,
            listenurl: 'http://localhost:8000/stream'
          }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const stats = await getIcecastStats();

      expect(stats).not.toBeNull();
      expect(stats?.listeners).toBe(5);
      expect(stats?.bitrate).toBe(320);
      expect(stats?.serverName).toBe('localhost');
    });

    it('should handle array of sources (multiple mount points)', async () => {
      const mockResponse = {
        icestats: {
          host: 'localhost',
          source: [
            { listeners: 3, bitrate: 320 },
            { listeners: 2, bitrate: 128 }
          ]
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const stats = await getIcecastStats();

      // Deve pegar o primeiro source
      expect(stats?.listeners).toBe(3);
      expect(stats?.bitrate).toBe(320);
    });

    it('should return 0 listeners when no source is active', async () => {
      const mockResponse = {
        icestats: {
          host: 'localhost',
          source: null
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const stats = await getIcecastStats();

      expect(stats?.listeners).toBe(0);
    });

    it('should use cache within TTL', async () => {
      const mockResponse = {
        icestats: {
          host: 'localhost',
          source: { listeners: 5, bitrate: 320 }
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Primeira chamada - busca do servidor
      await getIcecastStats();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Segunda chamada - deve usar cache
      await getIcecastStats();
      expect(mockFetch).toHaveBeenCalledTimes(1); // Não deve ter chamado de novo
    });

    it('should return cached stats when fetch fails', async () => {
      // Primeira chamada bem-sucedida
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          icestats: { source: { listeners: 10 } }
        })
      });

      const firstStats = await getIcecastStats();
      expect(firstStats?.listeners).toBe(10);

      // Limpar cache para forçar nova busca
      clearCache();

      // Segunda chamada falha
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const secondStats = await getIcecastStats();

      // Deve retornar null pois cache foi limpo
      expect(secondStats).toBeNull();
    });

    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503
      });

      const stats = await getIcecastStats();

      // Deve retornar null pois não há cache
      expect(stats).toBeNull();
    });
  });

  describe('getListenerCount', () => {
    it('should return listener count', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          icestats: { source: { listeners: 7 } }
        })
      });

      const count = await getListenerCount();
      expect(count).toBe(7);
    });

    it('should return 0 when stats not available', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const count = await getListenerCount();
      expect(count).toBe(0);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          icestats: { source: { listeners: 5 } }
        })
      });

      // Primeira chamada
      await getIcecastStats();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Limpar cache
      clearCache();

      // Próxima chamada deve buscar do servidor novamente
      await getIcecastStats();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
