import express, { Express } from 'express';
import request from 'supertest';
import { createEventsRouter } from '../../routes/events';
import { EventPersistence } from '../../services/event-persistence';
import prisma from '../../prisma/client';

// Mock do Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    audioEvent: {
      findMany: jest.fn(),
      count: jest.fn()
    }
  }
}));

// Mock do EventBus (para EventPersistence)
jest.mock('../../utils/event-bus', () => ({
  eventBus: {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    publish: jest.fn()
  }
}));

describe('Events Router', () => {
  let app: Express;
  let eventPersistence: EventPersistence;
  const mockFindMany = prisma.audioEvent.findMany as jest.Mock;
  const mockCount = prisma.audioEvent.count as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    app = express();
    app.use(express.json());

    eventPersistence = new EventPersistence();
    app.use('/api', createEventsRouter({ eventPersistence }));

    // Default mock responses
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);
  });

  describe('GET /api/events', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/api/events');
      expect(response.status).toBe(200);
    });

    it('should return JSON response', async () => {
      const response = await request(app).get('/api/events');
      expect(response.type).toBe('application/json');
    });

    it('should return empty events array when no events', async () => {
      const response = await request(app).get('/api/events');

      expect(response.body).toEqual({
        events: [],
        total: 0,
        hasMore: false
      });
    });

    it('should return events from database', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          sessionId: null,
          eventType: 'silence.detected',
          timestamp: new Date('2025-01-01T10:00:00.000Z'),
          metadata: { levelDb: -60, duration: 10 }
        },
        {
          id: 'event-2',
          sessionId: 'session-1',
          eventType: 'clipping.detected',
          timestamp: new Date('2025-01-01T11:00:00.000Z'),
          metadata: { levelDb: -0.5, count: 1 }
        }
      ];

      mockFindMany.mockResolvedValue(mockEvents);
      mockCount.mockResolvedValue(2);

      const response = await request(app).get('/api/events');

      expect(response.body.events).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.hasMore).toBe(false);

      expect(response.body.events[0]).toEqual({
        id: 'event-1',
        sessionId: null,
        eventType: 'silence.detected',
        timestamp: '2025-01-01T10:00:00.000Z',
        metadata: { levelDb: -60, duration: 10 }
      });
    });

    describe('Pagination', () => {
      it('should use default limit of 100', async () => {
        await request(app).get('/api/events');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 100,
            skip: 0
          })
        );
      });

      it('should respect custom limit', async () => {
        await request(app).get('/api/events?limit=50');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 50
          })
        );
      });

      it('should cap limit at 1000', async () => {
        await request(app).get('/api/events?limit=5000');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            take: 1000
          })
        );
      });

      it('should respect offset', async () => {
        await request(app).get('/api/events?offset=50');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 50
          })
        );
      });

      it('should calculate hasMore correctly', async () => {
        mockFindMany.mockResolvedValue([{
          id: '1',
          sessionId: null,
          eventType: 'test',
          timestamp: new Date(),
          metadata: null
        }]);
        mockCount.mockResolvedValue(150);

        const response = await request(app).get('/api/events?limit=1&offset=0');

        expect(response.body.hasMore).toBe(true);
      });

      it('should return hasMore false on last page', async () => {
        mockFindMany.mockResolvedValue([{
          id: '1',
          sessionId: null,
          eventType: 'test',
          timestamp: new Date(),
          metadata: null
        }]);
        mockCount.mockResolvedValue(1);

        const response = await request(app).get('/api/events?limit=10&offset=0');

        expect(response.body.hasMore).toBe(false);
      });

      it('should reject invalid limit', async () => {
        const response = await request(app).get('/api/events?limit=invalid');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Parâmetro inválido');
      });

      it('should reject negative offset', async () => {
        const response = await request(app).get('/api/events?offset=-1');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Parâmetro inválido');
      });
    });

    describe('Filtering', () => {
      it('should filter by session_id', async () => {
        await request(app).get('/api/events?session_id=test-session');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              sessionId: 'test-session'
            })
          })
        );
      });

      it('should filter by event_type', async () => {
        await request(app).get('/api/events?event_type=silence.detected');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              eventType: 'silence.detected'
            })
          })
        );
      });

      it('should filter by date_from', async () => {
        await request(app).get('/api/events?date_from=2025-01-01T00:00:00.000Z');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              timestamp: expect.objectContaining({
                gte: new Date('2025-01-01T00:00:00.000Z')
              })
            })
          })
        );
      });

      it('should filter by date_to', async () => {
        await request(app).get('/api/events?date_to=2025-01-31T23:59:59.999Z');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              timestamp: expect.objectContaining({
                lte: new Date('2025-01-31T23:59:59.999Z')
              })
            })
          })
        );
      });

      it('should filter by date range', async () => {
        await request(app).get(
          '/api/events?date_from=2025-01-01T00:00:00.000Z&date_to=2025-01-31T23:59:59.999Z'
        );

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              timestamp: {
                gte: new Date('2025-01-01T00:00:00.000Z'),
                lte: new Date('2025-01-31T23:59:59.999Z')
              }
            })
          })
        );
      });

      it('should combine multiple filters', async () => {
        await request(app).get(
          '/api/events?session_id=test&event_type=clipping.detected&limit=10'
        );

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              sessionId: 'test',
              eventType: 'clipping.detected'
            },
            take: 10
          })
        );
      });

      it('should reject invalid date_from', async () => {
        const response = await request(app).get('/api/events?date_from=invalid');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('date_from');
      });

      it('should reject invalid date_to', async () => {
        const response = await request(app).get('/api/events?date_to=invalid');

        expect(response.status).toBe(400);
        expect(response.body.message).toContain('date_to');
      });
    });

    describe('Ordering', () => {
      it('should order by timestamp descending', async () => {
        await request(app).get('/api/events');

        expect(mockFindMany).toHaveBeenCalledWith(
          expect.objectContaining({
            orderBy: { timestamp: 'desc' }
          })
        );
      });
    });

    describe('Error Handling', () => {
      it('should handle database errors gracefully', async () => {
        mockFindMany.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app).get('/api/events');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Erro ao buscar eventos');
        expect(response.body.message).toBe('Database connection failed');
      });
    });
  });

  describe('GET /api/events/stats', () => {
    it('should return 200 OK', async () => {
      eventPersistence.start();

      const response = await request(app).get('/api/events/stats');

      expect(response.status).toBe(200);
      await eventPersistence.destroy();
    });

    it('should return persistence stats', async () => {
      eventPersistence.start();

      const response = await request(app).get('/api/events/stats');

      expect(response.body).toEqual({
        isRunning: true,
        persistedCount: 0,
        errorCount: 0,
        currentSessionId: null,
        subscriptionCount: 6
      });

      await eventPersistence.destroy();
    });

    it('should return 503 when eventPersistence is not configured', async () => {
      const appWithoutPersistence = express();
      appWithoutPersistence.use('/api', createEventsRouter());

      const response = await request(appWithoutPersistence).get('/api/events/stats');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Serviço indisponível');
    });
  });
});
