/**
 * Tests for Discogs service
 */

import {
  releaseToAlbumData,
  isConfigured,
  DiscogsNotFoundError,
  DiscogsRateLimitError,
  DiscogsTimeoutError,
  DiscogsConfigError,
  type DiscogsRelease,
} from '../../services/discogs';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Discogs Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env vars
    delete process.env.DISCOGS_CONSUMER_KEY;
    delete process.env.DISCOGS_CONSUMER_SECRET;
  });

  describe('isConfigured', () => {
    it('should return false when env vars are not set', () => {
      expect(isConfigured()).toBe(false);
    });

    it('should return false when only key is set', () => {
      process.env.DISCOGS_CONSUMER_KEY = 'key';
      expect(isConfigured()).toBe(false);
    });

    it('should return false when only secret is set', () => {
      process.env.DISCOGS_CONSUMER_SECRET = 'secret';
      expect(isConfigured()).toBe(false);
    });

    it('should return true when both env vars are set', () => {
      process.env.DISCOGS_CONSUMER_KEY = 'key';
      process.env.DISCOGS_CONSUMER_SECRET = 'secret';
      expect(isConfigured()).toBe(true);
    });
  });

  describe('releaseToAlbumData', () => {
    const baseRelease: DiscogsRelease = {
      id: 12345,
      title: 'Test Album',
      artists: [{ name: 'Test Artist', anv: '', join: '', role: '', id: 1 }],
      year: 2023,
      labels: [{ name: 'Test Label', catno: 'TL-001', entity_type: 'Label', id: 1 }],
      formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP'] }],
      genres: ['Rock'],
      styles: ['Alternative'],
      country: 'US',
      uri: 'https://www.discogs.com/release/12345',
    };

    it('should extract basic album data', () => {
      const result = releaseToAlbumData(baseRelease);

      expect(result.title).toBe('Test Album');
      expect(result.artist).toBe('Test Artist');
      expect(result.year).toBe(2023);
      expect(result.label).toBe('Test Label');
      expect(result.discogsId).toBe(12345);
      expect(result.discogsUrl).toBe('https://www.discogs.com/release/12345');
    });

    it('should use ANV when available', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        artists: [{ name: 'The Beatles (2)', anv: 'The Beatles', join: '', role: '', id: 1 }],
      };

      const result = releaseToAlbumData(release);
      expect(result.artist).toBe('The Beatles');
    });

    it('should remove numeric suffixes from artist names', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        artists: [{ name: 'Pink Floyd (3)', anv: '', join: '', role: '', id: 1 }],
      };

      const result = releaseToAlbumData(release);
      expect(result.artist).toBe('Pink Floyd');
    });

    it('should handle multiple artists', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        artists: [
          { name: 'Artist One', anv: '', join: ', ', role: '', id: 1 },
          { name: 'Artist Two', anv: '', join: '', role: '', id: 2 },
        ],
      };

      const result = releaseToAlbumData(release);
      expect(result.artist).toBe('Artist One, Artist Two');
    });

    it('should handle missing year', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        year: 0,
      };

      const result = releaseToAlbumData(release);
      expect(result.year).toBeNull();
    });

    it('should handle missing labels', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        labels: [],
      };

      const result = releaseToAlbumData(release);
      expect(result.label).toBeNull();
    });

    it('should map LP format correctly', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        formats: [{ name: 'Vinyl', qty: '1', descriptions: ['LP', 'Album'] }],
      };

      const result = releaseToAlbumData(release);
      expect(result.format).toBe('LP');
    });

    it('should map EP format correctly', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        formats: [{ name: 'Vinyl', qty: '1', descriptions: ['EP'] }],
      };

      const result = releaseToAlbumData(release);
      expect(result.format).toBe('EP');
    });

    it('should map 7" single format correctly', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        formats: [{ name: 'Vinyl', qty: '1', descriptions: ['7"', 'Single'] }],
      };

      const result = releaseToAlbumData(release);
      expect(result.format).toBe('SINGLE_7');
    });

    it('should map 12" single format correctly', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        formats: [{ name: 'Vinyl', qty: '1', descriptions: ['12"', 'Single'] }],
      };

      const result = releaseToAlbumData(release);
      expect(result.format).toBe('SINGLE_12');
    });

    it('should map double LP format correctly', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        formats: [{ name: 'Vinyl', qty: '2', descriptions: ['LP'] }],
      };

      const result = releaseToAlbumData(release);
      expect(result.format).toBe('DOUBLE_LP');
    });

    it('should map box set format correctly', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        formats: [{ name: 'Box Set', qty: '4', descriptions: ['Box Set'] }],
      };

      const result = releaseToAlbumData(release);
      expect(result.format).toBe('BOX_SET');
    });

    it('should extract cover URL from primary image', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        images: [
          { type: 'secondary', uri: 'http://secondary.jpg', resource_url: '', uri150: '', width: 150, height: 150 },
          { type: 'primary', uri: 'http://primary.jpg', resource_url: '', uri150: '', width: 600, height: 600 },
        ],
      };

      const result = releaseToAlbumData(release);
      expect(result.coverUrl).toBe('http://primary.jpg');
    });

    it('should fallback to first image if no primary', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        images: [
          { type: 'secondary', uri: 'http://first.jpg', resource_url: '', uri150: '', width: 150, height: 150 },
          { type: 'secondary', uri: 'http://second.jpg', resource_url: '', uri150: '', width: 150, height: 150 },
        ],
      };

      const result = releaseToAlbumData(release);
      expect(result.coverUrl).toBe('http://first.jpg');
    });

    it('should handle missing images', () => {
      const result = releaseToAlbumData(baseRelease);
      expect(result.coverUrl).toBeNull();
    });

    it('should handle empty artists array', () => {
      const release: DiscogsRelease = {
        ...baseRelease,
        artists: [],
      };

      const result = releaseToAlbumData(release);
      expect(result.artist).toBe('Unknown Artist');
    });
  });

  describe('Error classes', () => {
    it('DiscogsNotFoundError should have correct name', () => {
      const error = new DiscogsNotFoundError('Not found');
      expect(error.name).toBe('DiscogsNotFoundError');
      expect(error.message).toBe('Not found');
    });

    it('DiscogsRateLimitError should have correct name', () => {
      const error = new DiscogsRateLimitError('Rate limit');
      expect(error.name).toBe('DiscogsRateLimitError');
      expect(error.message).toBe('Rate limit');
    });

    it('DiscogsTimeoutError should have correct name', () => {
      const error = new DiscogsTimeoutError('Timeout');
      expect(error.name).toBe('DiscogsTimeoutError');
      expect(error.message).toBe('Timeout');
    });

    it('DiscogsConfigError should have correct name', () => {
      const error = new DiscogsConfigError('Config');
      expect(error.name).toBe('DiscogsConfigError');
      expect(error.message).toBe('Config');
    });

    it('Error classes should have default messages', () => {
      expect(new DiscogsNotFoundError().message).toBe('Release não encontrado');
      expect(new DiscogsRateLimitError().message).toBe('Rate limit excedido');
      expect(new DiscogsTimeoutError().message).toBe('Timeout na requisição');
      expect(new DiscogsConfigError().message).toBe('Configuração do Discogs inválida');
    });
  });
});
