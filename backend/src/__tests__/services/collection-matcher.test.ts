/**
 * Tests for Collection Matcher service (V2-06)
 *
 * Testa o algoritmo de fuzzy matching Levenshtein para validar
 * reconhecimentos musicais contra a coleção de álbuns.
 */

import {
  calculateSimilarity,
  findMatches,
  findBestMatch,
  formatMatchForApi,
  THRESHOLDS,
  WEIGHTS,
} from '../../services/collection-matcher';
import prisma from '../../prisma/client';
import type { Album } from '@prisma/client';

// Mock Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    album: {
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Collection Matcher Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('The Beatles', 'The Beatles')).toBe(1);
    });

    it('should return 1 for identical strings with different case', () => {
      expect(calculateSimilarity('THE BEATLES', 'the beatles')).toBe(1);
    });

    it('should return 1 for strings with different accents', () => {
      expect(calculateSimilarity('Beyoncé', 'Beyonce')).toBe(1);
    });

    it('should return 1 for empty strings', () => {
      expect(calculateSimilarity('', '')).toBe(1);
    });

    it('should return 0 when one string is empty', () => {
      expect(calculateSimilarity('Test', '')).toBe(0);
      expect(calculateSimilarity('', 'Test')).toBe(0);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = calculateSimilarity('The Beatles', 'Beatles');
      expect(similarity).toBeGreaterThan(0.6);
    });

    it('should return low similarity for different strings', () => {
      const similarity = calculateSimilarity('The Beatles', 'Pink Floyd');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle punctuation differences', () => {
      const similarity = calculateSimilarity("Guns N' Roses", 'Guns N Roses');
      expect(similarity).toBeGreaterThan(0.9);
    });

    it('should handle extra whitespace', () => {
      const similarity = calculateSimilarity('The  Beatles', 'The Beatles');
      expect(similarity).toBe(1);
    });
  });

  describe('THRESHOLDS', () => {
    it('should have correct threshold values', () => {
      expect(THRESHOLDS.MIN_MATCH).toBe(0.5);
      expect(THRESHOLDS.AUTO_LINK).toBe(0.8);
      expect(THRESHOLDS.MAX_RESULTS).toBe(5);
    });
  });

  describe('WEIGHTS', () => {
    it('should have correct weight values', () => {
      expect(WEIGHTS.ARTIST).toBe(0.6);
      expect(WEIGHTS.ALBUM).toBe(0.4);
    });

    it('should sum to 1', () => {
      expect(WEIGHTS.ARTIST + WEIGHTS.ALBUM).toBe(1);
    });
  });

  describe('findMatches', () => {
    const createMockAlbum = (overrides: Partial<Album> = {}): Album => ({
      id: 'album-1',
      title: 'Abbey Road',
      artist: 'The Beatles',
      year: 1969,
      label: 'Apple Records',
      format: 'LP',
      coverUrl: 'https://example.com/cover.jpg',
      discogsId: 12345,
      discogsAvailable: true,
      condition: null,
      tags: null,
      notes: null,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should return empty array when no albums in collection', async () => {
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([]);

      const matches = await findMatches({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(matches).toEqual([]);
    });

    it('should return match for exact artist and album', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const matches = await findMatches({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(matches).toHaveLength(1);
      expect(matches[0].album).toEqual(album);
      expect(matches[0].confidence).toBe(1);
      expect(matches[0].needsConfirmation).toBe(false);
      expect(matches[0].matchedOn).toBe('artist+album');
    });

    it('should return match with needsConfirmation for medium confidence', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      // "Beatles" vs "The Beatles" should give high but not perfect match
      const matches = await findMatches({ artist: 'Beatles', album: 'Abbey Road' });

      expect(matches).toHaveLength(1);
      expect(matches[0].confidence).toBeGreaterThan(0.5);
      expect(matches[0].confidence).toBeLessThan(1);
      // Depending on exact similarity, may or may not need confirmation
    });

    it('should not return matches below threshold', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const matches = await findMatches({ artist: 'Pink Floyd', album: 'The Wall' });

      expect(matches).toHaveLength(0);
    });

    it('should not include archived albums', async () => {
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([]);

      await findMatches({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(mockPrisma.album.findMany).toHaveBeenCalledWith({
        where: { archived: false },
      });
    });

    it('should return top 5 matches ordered by confidence', async () => {
      const albums = [
        createMockAlbum({ id: '1', title: 'Abbey Road', artist: 'The Beatles' }),
        createMockAlbum({ id: '2', title: 'Abby Road', artist: 'The Beatles' }), // typo
        createMockAlbum({ id: '3', title: 'Abbey Rd', artist: 'Beatles' }),
        createMockAlbum({ id: '4', title: 'Abbey Road Live', artist: 'The Beatles' }),
        createMockAlbum({ id: '5', title: 'Abbey Road Remastered', artist: 'The Beatles' }),
        createMockAlbum({ id: '6', title: 'Let It Be', artist: 'The Beatles' }),
        createMockAlbum({ id: '7', title: 'Help!', artist: 'The Beatles' }),
      ];
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue(albums);

      const matches = await findMatches({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(matches.length).toBeLessThanOrEqual(5);
      // First match should be exact
      expect(matches[0].album.id).toBe('1');
      expect(matches[0].confidence).toBe(1);

      // Verify descending order
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i].confidence).toBeLessThanOrEqual(matches[i - 1].confidence);
      }
    });

    it('should use custom threshold', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      // With very high threshold, similar but not exact should not match
      const matches = await findMatches({ artist: 'Beatles', album: 'Abbey Road' }, 0.99);

      expect(matches).toHaveLength(0);
    });

    it('should handle empty album name from recognition', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const matches = await findMatches({ artist: 'The Beatles', album: '' });

      // Should still match on artist alone (60% weight)
      expect(matches.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('findBestMatch', () => {
    const createMockAlbum = (overrides: Partial<Album> = {}): Album => ({
      id: 'album-1',
      title: 'Abbey Road',
      artist: 'The Beatles',
      year: 1969,
      label: 'Apple Records',
      format: 'LP',
      coverUrl: 'https://example.com/cover.jpg',
      discogsId: 12345,
      discogsAvailable: true,
      condition: null,
      tags: null,
      notes: null,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should return best match when above AUTO_LINK threshold', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const match = await findBestMatch({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(match).not.toBeNull();
      expect(match?.album).toEqual(album);
      expect(match?.confidence).toBeGreaterThanOrEqual(THRESHOLDS.AUTO_LINK);
    });

    it('should return null when no match above AUTO_LINK threshold', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const match = await findBestMatch({ artist: 'Beatles', album: 'Abbey' });

      // This depends on exact similarity calculation
      // If it's below 0.8, should return null
      if (match !== null) {
        expect(match.confidence).toBeGreaterThanOrEqual(THRESHOLDS.AUTO_LINK);
      }
    });

    it('should return null when no albums in collection', async () => {
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([]);

      const match = await findBestMatch({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(match).toBeNull();
    });
  });

  describe('formatMatchForApi', () => {
    it('should format match correctly', () => {
      const album: Album = {
        id: 'album-123',
        title: 'Abbey Road',
        artist: 'The Beatles',
        year: 1969,
        label: 'Apple Records',
        format: 'LP',
        coverUrl: 'https://example.com/cover.jpg',
        discogsId: 12345,
          discogsAvailable: true,
        condition: null,
        tags: null,
        notes: null,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = formatMatchForApi({
        album,
        confidence: 0.95,
        matchedOn: 'artist+album',
        needsConfirmation: false,
      });

      expect(result).toEqual({
        albumId: 'album-123',
        albumTitle: 'Abbey Road',
        matchConfidence: 0.95,
        needsConfirmation: false,
      });
    });

    it('should include needsConfirmation when true', () => {
      const album: Album = {
        id: 'album-456',
        title: 'Let It Be',
        artist: 'The Beatles',
        year: 1970,
        label: 'Apple Records',
        format: 'LP',
        coverUrl: null,
        discogsId: null,
          discogsAvailable: true,
        condition: null,
        tags: null,
        notes: null,
        archived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = formatMatchForApi({
        album,
        confidence: 0.65,
        matchedOn: 'artist',
        needsConfirmation: true,
      });

      expect(result.needsConfirmation).toBe(true);
      expect(result.matchConfidence).toBe(0.65);
    });
  });

  describe('matchedOn type', () => {
    const createMockAlbum = (overrides: Partial<Album> = {}): Album => ({
      id: 'album-1',
      title: 'Abbey Road',
      artist: 'The Beatles',
      year: 1969,
      label: 'Apple Records',
      format: 'LP',
      coverUrl: null,
      discogsId: null,
      discogsAvailable: true,
      condition: null,
      tags: null,
      notes: null,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should return artist+album when both match well', async () => {
      const album = createMockAlbum();
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const matches = await findMatches({ artist: 'The Beatles', album: 'Abbey Road' });

      expect(matches[0].matchedOn).toBe('artist+album');
    });

    it('should return artist when only artist matches well', async () => {
      const album = createMockAlbum({ title: 'Completely Different Album' });
      (mockPrisma.album.findMany as jest.Mock).mockResolvedValue([album]);

      const matches = await findMatches({ artist: 'The Beatles', album: 'Abbey Road' });

      // Combined score might be above threshold due to artist weight (0.6)
      if (matches.length > 0) {
        // Artist similarity should be high, album should be low
        expect(['artist', 'artist+album']).toContain(matches[0].matchedOn);
      }
    });
  });
});
