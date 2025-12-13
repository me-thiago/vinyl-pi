import express, { Express } from 'express';
import request from 'supertest';
import { createSessionsRouter } from '../../routes/sessions';
import { SessionManager } from '../../services/session-manager';
import prisma from '../../prisma/client';

// Mock do Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    session: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn()
    },
    album: {
      findUnique: jest.fn()
    },
    sessionAlbum: {
      findUnique: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn()
    }
  }
}));

// Mock do EventBus (para SessionManager)
jest.mock('../../utils/event-bus', () => ({
  eventBus: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn()
  }
}));

describe('Sessions Router', () => {
  let app: Express;
  let sessionManager: SessionManager;
  const mockFindMany = prisma.session.findMany as jest.Mock;
  const mockFindUnique = prisma.session.findUnique as jest.Mock;
  const mockCount = prisma.session.count as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    sessionManager = new SessionManager({ sessionTimeout: 60 });
    app.use('/api', createSessionsRouter({ sessionManager }));

    // Default mock responses
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('GET /api/sessions', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/api/sessions');
      expect(response.status).toBe(200);
    });

    it('should return JSON response', async () => {
      const response = await request(app).get('/api/sessions');
      expect(response.type).toBe('application/json');
    });

    it('should return empty sessions array when no sessions', async () => {
      const response = await request(app).get('/api/sessions');

      expect(response.body).toEqual({
        sessions: [],
        total: 0,
        hasMore: false
      });
    });

    it('should return sessions from database', async () => {
      // V3a-09: Mock sessions now use _count.sessionAlbums for albumCount
      const mockSessions = [
        {
          id: 'session-1',
          startedAt: new Date('2025-01-01T10:00:00.000Z'),
          endedAt: new Date('2025-01-01T11:00:00.000Z'),
          durationSeconds: 3600,
          eventCount: 10,
          _count: { sessionAlbums: 2 }
        },
        {
          id: 'session-2',
          startedAt: new Date('2025-01-01T14:00:00.000Z'),
          endedAt: null,
          durationSeconds: 0,
          eventCount: 5,
          _count: { sessionAlbums: 0 }
        }
      ];

      mockFindMany.mockResolvedValue(mockSessions);
      mockCount.mockResolvedValue(2);

      const response = await request(app).get('/api/sessions');

      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.hasMore).toBe(false);

      // V3a-09: albumCount comes from _count.sessionAlbums
      expect(response.body.sessions[0]).toEqual({
        id: 'session-1',
        startedAt: '2025-01-01T10:00:00.000Z',
        endedAt: '2025-01-01T11:00:00.000Z',
        durationSeconds: 3600,
        eventCount: 10,
        albumCount: 2
      });

      expect(response.body.sessions[1].endedAt).toBeNull();
      expect(response.body.sessions[1].albumCount).toBe(0);
    });

    describe('Pagination', () => {
      it('should use default limit of 20', async () => {
        await request(app).get('/api/sessions');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 20,
            skip: 0
          })
        );
      });

      it('should respect custom limit', async () => {
        await request(app).get('/api/sessions?limit=10');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 10
          })
        );
      });

      it('should reject limit above 100', async () => {
        const response = await request(app).get('/api/sessions?limit=500');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details[0].campo).toBe('limit');
      });

      it('should respect offset', async () => {
        await request(app).get('/api/sessions?offset=10');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10
          })
        );
      });

      it('should calculate hasMore correctly', async () => {
        // V3a-09: Include _count.sessionAlbums for albumCount calculation
        mockFindMany.mockResolvedValue([{
          id: '1',
          startedAt: new Date(),
          endedAt: null,
          durationSeconds: 0,
          eventCount: 0,
          _count: { sessionAlbums: 0 }
        }]);
        mockCount.mockResolvedValue(50);

        const response = await request(app).get('/api/sessions?limit=1&offset=0');

        expect(response.body.hasMore).toBe(true);
      });

      it('should reject invalid limit', async () => {
        const response = await request(app).get('/api/sessions?limit=invalid');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details[0].campo).toBe('limit');
      });

      it('should reject negative offset', async () => {
        const response = await request(app).get('/api/sessions?offset=-1');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details[0].campo).toBe('offset');
      });
    });

    describe('Date Filtering', () => {
      it('should filter by date_from', async () => {
        await request(app).get('/api/sessions?date_from=2025-01-01T00:00:00.000Z');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              startedAt: expect.objectContaining({
                gte: new Date('2025-01-01T00:00:00.000Z')
              })
            })
          })
        );
      });

      it('should filter by date_to', async () => {
        await request(app).get('/api/sessions?date_to=2025-01-31T23:59:59.999Z');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              startedAt: expect.objectContaining({
                lte: new Date('2025-01-31T23:59:59.999Z')
              })
            })
          })
        );
      });

      it('should filter by date range', async () => {
        await request(app).get(
          '/api/sessions?date_from=2025-01-01T00:00:00.000Z&date_to=2025-01-31T23:59:59.999Z'
        );

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              startedAt: {
                gte: new Date('2025-01-01T00:00:00.000Z'),
                lte: new Date('2025-01-31T23:59:59.999Z')
              }
            })
          })
        );
      });

      it('should reject invalid date_from', async () => {
        const response = await request(app).get('/api/sessions?date_from=invalid');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details[0].campo).toBe('date_from');
      });

      it('should reject invalid date_to', async () => {
        const response = await request(app).get('/api/sessions?date_to=invalid');

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
        expect(response.body.error.details[0].campo).toBe('date_to');
      });
    });

    describe('Ordering', () => {
      it('should order by startedAt descending', async () => {
        await request(app).get('/api/sessions');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { startedAt: 'desc' }
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockFindMany.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app).get('/api/sessions');

        expect(response.status).toBe(500);
        expect(response.body.error.message).toBe('Erro ao buscar sessões');
        expect(response.body.error.code).toBe('SESSIONS_FETCH_ERROR');
      });
    });
  });

  describe('GET /api/sessions/active', () => {
    it('should return 200 OK', async () => {
      sessionManager.start();
      const response = await request(app).get('/api/sessions/active');

      expect(response.status).toBe(200);
      await sessionManager.destroy();
    });

    it('should return active: false when no session', async () => {
      sessionManager.start();
      const response = await request(app).get('/api/sessions/active');

      expect(response.body).toEqual({
        active: false,
        session: null
      });

      await sessionManager.destroy();
    });

    it('should return 503 when sessionManager not configured', async () => {
      const appWithoutManager = express();
      appWithoutManager.use('/api', createSessionsRouter());

      const response = await request(appWithoutManager).get('/api/sessions/active');

      expect(response.status).toBe(503);
      expect(response.body.error.message).toBe('Serviço indisponível: SessionManager não está configurado');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session with events and albums', async () => {
      // V3a-09: Mock session now includes sessionAlbums for album list
      const mockSession = {
        id: 'session-123',
        startedAt: new Date('2025-01-01T10:00:00.000Z'),
        endedAt: new Date('2025-01-01T11:00:00.000Z'),
        durationSeconds: 3600,
        eventCount: 2,
        audioEvents: [
          {
            id: 'event-1',
            eventType: 'silence.detected',
            timestamp: new Date('2025-01-01T10:30:00.000Z'),
            metadata: { levelDb: -60 }
          },
          {
            id: 'event-2',
            eventType: 'silence.ended',
            timestamp: new Date('2025-01-01T10:35:00.000Z'),
            metadata: { levelDb: -30 }
          }
        ],
        sessionAlbums: [
          {
            source: 'recognition',
            addedAt: new Date('2025-01-01T10:15:00.000Z'),
            notes: null,
            album: {
              id: 'album-1',
              title: 'The Dark Side of the Moon',
              artist: 'Pink Floyd',
              year: 1973,
              coverUrl: 'https://example.com/cover.jpg'
            }
          }
        ]
      };

      mockFindUnique.mockResolvedValue(mockSession);

      const response = await request(app).get('/api/sessions/session-123');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        id: 'session-123',
        startedAt: '2025-01-01T10:00:00.000Z',
        endedAt: '2025-01-01T11:00:00.000Z',
        durationSeconds: 3600,
        eventCount: 2,
        events: [
          {
            id: 'event-1',
            eventType: 'silence.detected',
            timestamp: '2025-01-01T10:30:00.000Z',
            metadata: { levelDb: -60 }
          },
          {
            id: 'event-2',
            eventType: 'silence.ended',
            timestamp: '2025-01-01T10:35:00.000Z',
            metadata: { levelDb: -30 }
          }
        ],
        // V3a-09: Albums now include source, addedAt, notes
        albums: [
          {
            id: 'album-1',
            title: 'The Dark Side of the Moon',
            artist: 'Pink Floyd',
            year: 1973,
            coverUrl: 'https://example.com/cover.jpg',
            source: 'recognition',
            addedAt: '2025-01-01T10:15:00.000Z',
            notes: null
          }
        ]
      });
    });

    it('should return 404 for non-existent session', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app).get('/api/sessions/non-existent');

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Sessão não encontrada');
    });

    it('should order events by timestamp ascending and include sessionAlbums', async () => {
      // V3a-09: Update test to reflect new query that includes sessionAlbums
      await request(app).get('/api/sessions/session-123');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'session-123' },
        include: {
          audioEvents: {
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              eventType: true,
              timestamp: true,
              metadata: true
            }
          },
          // V3a-09: Now includes sessionAlbums
          sessionAlbums: {
            orderBy: { addedAt: 'asc' },
            include: {
              album: {
                select: { id: true, title: true, artist: true, year: true, coverUrl: true }
              }
            }
          }
        }
      });
    });

    it('should handle database errors gracefully', async () => {
      mockFindUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app).get('/api/sessions/session-123');

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Erro ao buscar sessão');
      expect(response.body.error.code).toBe('SESSION_FETCH_ERROR');
    });
  });

  // V3a-09: Testes para novos endpoints de SessionAlbum
  describe('POST /api/sessions/:id/albums', () => {
    const mockAlbumFindUnique = prisma.album.findUnique as jest.Mock;
    const mockSessionAlbumFindUnique = prisma.sessionAlbum.findUnique as jest.Mock;
    const mockSessionAlbumCreate = prisma.sessionAlbum.create as jest.Mock;

    const mockAlbum = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      title: 'Kind of Blue',
      artist: 'Miles Davis',
      year: 1959,
      coverUrl: 'http://example.com/cover.jpg'
    };

    beforeEach(() => {
      mockFindUnique.mockResolvedValue({ id: 'session-1' }); // Session exists
      mockAlbumFindUnique.mockResolvedValue(mockAlbum);
      mockSessionAlbumFindUnique.mockResolvedValue(null); // Not already linked
    });

    it('should add album to session successfully', async () => {
      mockSessionAlbumCreate.mockResolvedValue({
        album: mockAlbum,
        source: 'manual',
        addedAt: new Date('2025-01-01T10:30:00.000Z'),
        notes: 'Lado B'
      });

      const response = await request(app)
        .post('/api/sessions/session-1/albums')
        .send({
          albumId: '550e8400-e29b-41d4-a716-446655440000',
          notes: 'Lado B'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Kind of Blue',
        source: 'manual',
        notes: 'Lado B'
      });
    });

    it('should return 404 when session not found', async () => {
      mockFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/sessions/non-existent/albums')
        .send({ albumId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('should return 404 when album not found', async () => {
      mockAlbumFindUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/sessions/session-1/albums')
        .send({ albumId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ALBUM_NOT_FOUND');
    });

    it('should return 409 when album already in session', async () => {
      mockSessionAlbumFindUnique.mockResolvedValue({ id: 'existing-link' });

      const response = await request(app)
        .post('/api/sessions/session-1/albums')
        .send({ albumId: '550e8400-e29b-41d4-a716-446655440000' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('ALBUM_ALREADY_IN_SESSION');
    });

    it('should return 400 when albumId is invalid UUID', async () => {
      const response = await request(app)
        .post('/api/sessions/session-1/albums')
        .send({ albumId: 'not-a-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 when albumId is missing', async () => {
      const response = await request(app)
        .post('/api/sessions/session-1/albums')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/sessions/:id/albums/:albumId', () => {
    const mockSessionAlbumDeleteMany = prisma.sessionAlbum.deleteMany as jest.Mock;

    it('should remove album from session successfully', async () => {
      mockSessionAlbumDeleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .delete('/api/sessions/session-1/albums/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(200);
      expect(response.body.data.deleted).toBe(1);
    });

    it('should return 404 when album not in session', async () => {
      mockSessionAlbumDeleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app)
        .delete('/api/sessions/session-1/albums/550e8400-e29b-41d4-a716-446655440000');

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('ALBUM_NOT_IN_SESSION');
    });

    it('should return 400 when albumId is invalid UUID', async () => {
      const response = await request(app)
        .delete('/api/sessions/session-1/albums/not-a-uuid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
