/**
 * Testes unitários para Recognition Service (V2-05, V2-06)
 *
 * Testa:
 * - Verificação de configuração
 * - Erros conhecidos
 * - Confirm track album
 *
 * Nota: Testes de captura FFmpeg e chamadas AudD reais são
 * integration tests - aqui mockamos as dependências externas.
 */

import {
  isConfigured,
  confirmTrackAlbum,
  RecognitionError,
  NotConfiguredError,
  CaptureError,
  AudDError,
  ACRCloudError, // Legacy alias
  NoSessionError,
} from '../../services/recognition';

// Mock do Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    track: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    album: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock do EventBus
jest.mock('../../utils/event-bus', () => ({
  eventBus: {
    publish: jest.fn(),
  },
}));

import prisma from '../../prisma/client';

describe('Recognition Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('deve retornar true quando AUDD_API_KEY está configurada', () => {
      process.env.AUDD_API_KEY = 'test-api-key';

      expect(isConfigured()).toBe(true);
    });

    it('deve retornar false quando AUDD_API_KEY falta', () => {
      delete process.env.AUDD_API_KEY;

      expect(isConfigured()).toBe(false);
    });

    it('deve retornar false quando AUDD_API_KEY está vazia', () => {
      process.env.AUDD_API_KEY = '';

      expect(isConfigured()).toBe(false);
    });
  });

  describe('confirmTrackAlbum', () => {
    const mockTrack = {
      id: 'track-123',
      sessionId: 'session-456',
      title: 'Hey Jude',
      artist: 'The Beatles',
      albumId: null,
    };

    const mockAlbum = {
      id: 'album-789',
      title: 'Hey Jude',
      artist: 'The Beatles',
    };

    it('deve vincular track a álbum com sucesso', async () => {
      (prisma.track.findUnique as jest.Mock).mockResolvedValue(mockTrack);
      (prisma.album.findUnique as jest.Mock).mockResolvedValue(mockAlbum);
      (prisma.track.update as jest.Mock).mockResolvedValue({
        ...mockTrack,
        albumId: mockAlbum.id,
      });

      const result = await confirmTrackAlbum('track-123', 'album-789');

      expect(result.id).toBe('track-123');
      expect(result.albumId).toBe('album-789');
      expect(prisma.track.update).toHaveBeenCalledWith({
        where: { id: 'track-123' },
        data: { albumId: 'album-789' },
      });
    });

    it('deve desvincular track quando albumId é null', async () => {
      const trackWithAlbum = { ...mockTrack, albumId: 'album-789' };
      (prisma.track.findUnique as jest.Mock).mockResolvedValue(trackWithAlbum);
      (prisma.track.update as jest.Mock).mockResolvedValue({
        ...mockTrack,
        albumId: null,
      });

      const result = await confirmTrackAlbum('track-123', null);

      expect(result.albumId).toBeNull();
      expect(prisma.track.update).toHaveBeenCalledWith({
        where: { id: 'track-123' },
        data: { albumId: null },
      });
    });

    it('deve lançar erro quando track não existe', async () => {
      (prisma.track.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(confirmTrackAlbum('invalid-id', null)).rejects.toThrow(
        RecognitionError
      );

      try {
        await confirmTrackAlbum('invalid-id', null);
      } catch (error) {
        expect(error).toBeInstanceOf(RecognitionError);
        expect((error as RecognitionError).code).toBe('TRACK_NOT_FOUND');
      }
    });

    it('deve lançar erro quando álbum não existe', async () => {
      (prisma.track.findUnique as jest.Mock).mockResolvedValue(mockTrack);
      (prisma.album.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        confirmTrackAlbum('track-123', 'invalid-album')
      ).rejects.toThrow(RecognitionError);

      try {
        await confirmTrackAlbum('track-123', 'invalid-album');
      } catch (error) {
        expect(error).toBeInstanceOf(RecognitionError);
        expect((error as RecognitionError).code).toBe('ALBUM_NOT_FOUND');
      }
    });
  });

  describe('Error classes', () => {
    describe('RecognitionError', () => {
      it('deve criar erro com code e message', () => {
        const error = new RecognitionError('Test message', 'TEST_CODE');
        expect(error.message).toBe('Test message');
        expect(error.code).toBe('TEST_CODE');
        expect(error.name).toBe('RecognitionError');
      });

      it('deve aceitar details opcionais', () => {
        const details = { extra: 'info' };
        const error = new RecognitionError('Test', 'CODE', details);
        expect(error.details).toEqual(details);
      });
    });

    describe('NoSessionError', () => {
      it('deve ter código NO_ACTIVE_SESSION', () => {
        const error = new NoSessionError();
        expect(error.code).toBe('NO_ACTIVE_SESSION');
        expect(error.message).toBe('Nenhuma sessão ativa');
      });
    });

    describe('CaptureError', () => {
      it('deve ter código CAPTURE_ERROR', () => {
        const error = new CaptureError('FFmpeg failed');
        expect(error.code).toBe('CAPTURE_ERROR');
        expect(error.details).toBe('FFmpeg failed');
      });
    });

    describe('AudDError', () => {
      it('deve ter nome AudDError', () => {
        const error = new AudDError('Timeout', 'AUDD_TIMEOUT');
        expect(error.name).toBe('AudDError');
        expect(error.code).toBe('AUDD_TIMEOUT');
      });
    });

    describe('ACRCloudError (legacy alias)', () => {
      it('deve ser alias para AudDError', () => {
        const error = new ACRCloudError('Timeout', 'AUDD_TIMEOUT');
        expect(error.name).toBe('AudDError');
        expect(error.code).toBe('AUDD_TIMEOUT');
      });
    });

    describe('NotConfiguredError', () => {
      it('deve ter código RECOGNITION_NOT_CONFIGURED', () => {
        const error = new NotConfiguredError();
        expect(error.code).toBe('RECOGNITION_NOT_CONFIGURED');
        expect(error.message).toContain('AUDD_API_KEY');
      });
    });
  });
});
