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
      // V2-09: Mock sessions now include tracks for albumCount calculation
      const mockSessions = [
        {
          id: 'session-1',
          startedAt: new Date('2025-01-01T10:00:00.000Z'),
          endedAt: new Date('2025-01-01T11:00:00.000Z'),
          durationSeconds: 3600,
          eventCount: 10,
          tracks: [
            { albumId: 'album-1' },
            { albumId: 'album-1' }, // Same album, should count as 1
            { albumId: 'album-2' }
          ]
        },
        {
          id: 'session-2',
          startedAt: new Date('2025-01-01T14:00:00.000Z'),
          endedAt: null,
          durationSeconds: 0,
          eventCount: 5,
          tracks: [] // No albums
        }
      ];

      mockFindMany.mockResolvedValue(mockSessions);
      mockCount.mockResolvedValue(2);

      const response = await request(app).get('/api/sessions');

      expect(response.body.sessions).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.hasMore).toBe(false);

      // V2-09: Now includes albumCount
      expect(response.body.sessions[0]).toEqual({
        id: 'session-1',
        startedAt: '2025-01-01T10:00:00.000Z',
        endedAt: '2025-01-01T11:00:00.000Z',
        durationSeconds: 3600,
        eventCount: 10,
        albumCount: 2 // 2 unique albums
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
        // V2-09: Include tracks array for albumCount calculation
        mockFindMany.mockResolvedValue([{
          id: '1',
          startedAt: new Date(),
          endedAt: null,
          durationSeconds: 0,
          eventCount: 0,
          tracks: []
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
      // V2-09: Mock session now includes tracks for album grouping
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
        tracks: [
          {
            albumId: 'album-1',
            title: 'Money',
            recognizedAt: new Date('2025-01-01T10:15:00.000Z'),
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
        // V2-09: Now includes albums array
        albums: [
          {
            id: 'album-1',
            title: 'The Dark Side of the Moon',
            artist: 'Pink Floyd',
            year: 1973,
            coverUrl: 'https://example.com/cover.jpg',
            recognizedTrack: {
              title: 'Money',
              recognizedAt: '2025-01-01T10:15:00.000Z'
            }
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

    it('should order events by timestamp ascending and include tracks', async () => {
      // V2-09: Update test to reflect new query that includes tracks
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
          // V2-09: Now includes tracks for album grouping
          tracks: {
            where: { albumId: { not: null } },
            orderBy: { recognizedAt: 'asc' },
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
});
