import { EventPersistence } from '../../services/event-persistence';
import { eventBus } from '../../utils/event-bus';
import prisma from '../../prisma/client';

// Mock do EventBus
jest.mock('../../utils/event-bus', () => {
  const handlers = new Map<string, Set<Function>>();

  return {
    eventBus: {
      publish: jest.fn().mockImplementation(async (event: string, payload: any) => {
        const eventHandlers = handlers.get(event);
        if (eventHandlers) {
          for (const handler of eventHandlers) {
            await handler(payload);
          }
        }
      }),
      subscribe: jest.fn().mockImplementation((event: string, handler: Function) => {
        if (!handlers.has(event)) {
          handlers.set(event, new Set());
        }
        handlers.get(event)!.add(handler);
      }),
      unsubscribe: jest.fn().mockImplementation((event: string, handler: Function) => {
        handlers.get(event)?.delete(handler);
      }),
      clearAllListeners: jest.fn().mockImplementation(() => {
        handlers.clear();
      })
    }
  };
});

// Mock do Prisma
jest.mock('../../prisma/client', () => ({
  __esModule: true,
  default: {
    audioEvent: {
      create: jest.fn().mockResolvedValue({
        id: 'test-id',
        eventType: 'test',
        sessionId: null,
        timestamp: new Date(),
        metadata: {}
      })
    }
  }
}));

describe('EventPersistence', () => {
  let persistence: EventPersistence;
  const mockCreate = prisma.audioEvent.create as jest.Mock;
  const mockSubscribe = eventBus.subscribe as jest.Mock;
  const mockUnsubscribe = eventBus.unsubscribe as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    persistence = new EventPersistence();
  });

  afterEach(async () => {
    await persistence.destroy();
  });

  describe('Initialization', () => {
    it('should create with default state', () => {
      const stats = persistence.getStats();

      expect(stats.isRunning).toBe(false);
      expect(stats.persistedCount).toBe(0);
      expect(stats.errorCount).toBe(0);
      expect(stats.currentSessionId).toBeNull();
      expect(stats.subscriptionCount).toBe(0);
    });

    it('should not be running initially', () => {
      expect(persistence.getStats().isRunning).toBe(false);
    });

    it('should have null sessionId initially', () => {
      expect(persistence.getCurrentSessionId()).toBeNull();
    });
  });

  describe('Start/Stop', () => {
    it('should start and subscribe to all events', () => {
      persistence.start();

      expect(persistence.getStats().isRunning).toBe(true);
      expect(mockSubscribe).toHaveBeenCalledWith('silence.detected', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('silence.ended', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('clipping.detected', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('session.started', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('session.ended', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('track.change.detected', expect.any(Function));
    });

    it('should have 6 subscriptions after start', () => {
      persistence.start();
      expect(persistence.getStats().subscriptionCount).toBe(6);
    });

    it('should stop and cleanup subscriptions', async () => {
      persistence.start();
      await persistence.stop();

      expect(persistence.getStats().isRunning).toBe(false);
      expect(persistence.getStats().subscriptionCount).toBe(0);
    });

    it('should handle multiple start calls gracefully', () => {
      persistence.start();
      persistence.start(); // Should not throw

      expect(persistence.getStats().isRunning).toBe(true);
      expect(persistence.getStats().subscriptionCount).toBe(6); // Still 6
    });

    it('should implement destroy() as alias for stop()', async () => {
      persistence.start();
      expect(persistence.getStats().isRunning).toBe(true);

      await persistence.destroy();

      expect(persistence.getStats().isRunning).toBe(false);
    });
  });

  describe('Event Persistence', () => {
    beforeEach(() => {
      persistence.start();
    });

    it('should persist silence.detected event', async () => {
      await eventBus.publish('silence.detected', {
        timestamp: '2025-01-01T00:00:00.000Z',
        levelDb: -60,
        duration: 10,
        threshold: -50
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          eventType: 'silence_detected', // Enum value stored in DB
          sessionId: null,
          metadata: {
            levelDb: -60,
            duration: 10,
            threshold: -50
          },
          timestamp: expect.any(Date)
        }
      });
      expect(persistence.getStats().persistedCount).toBe(1);
    });

    it('should persist silence.ended event', async () => {
      await eventBus.publish('silence.ended', {
        timestamp: '2025-01-01T00:00:00.000Z',
        levelDb: -30,
        silenceDuration: 15
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          eventType: 'silence_ended', // Enum value stored in DB
          sessionId: null,
          metadata: {
            levelDb: -30,
            silenceDuration: 15
          },
          timestamp: expect.any(Date)
        }
      });
      expect(persistence.getStats().persistedCount).toBe(1);
    });

    it('should persist clipping.detected event', async () => {
      await eventBus.publish('clipping.detected', {
        timestamp: '2025-01-01T00:00:00.000Z',
        levelDb: -0.5,
        threshold: -1,
        count: 5
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          eventType: 'clipping_detected', // Enum value stored in DB
          sessionId: null,
          metadata: {
            levelDb: -0.5,
            threshold: -1,
            count: 5
          },
          timestamp: expect.any(Date)
        }
      });
      expect(persistence.getStats().persistedCount).toBe(1);
    });

    it('should persist multiple events and count correctly', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 });
      await eventBus.publish('clipping.detected', { levelDb: -0.5, threshold: -1, count: 1 });
      await eventBus.publish('silence.ended', { levelDb: -30, silenceDuration: 15 });

      expect(persistence.getStats().persistedCount).toBe(3);
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      persistence.start();
    });

    it('should set sessionId when session.started is received', async () => {
      await eventBus.publish('session.started', { sessionId: 'test-session-123' });

      expect(persistence.getCurrentSessionId()).toBe('test-session-123');
    });

    it('should clear sessionId when session.ended is received', async () => {
      await eventBus.publish('session.started', { sessionId: 'test-session-123' });
      expect(persistence.getCurrentSessionId()).toBe('test-session-123');

      await eventBus.publish('session.ended', { sessionId: 'test-session-123' });
      expect(persistence.getCurrentSessionId()).toBeNull();
    });

    it('should include sessionId in persisted events', async () => {
      await eventBus.publish('session.started', { sessionId: 'test-session-456' });

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 });

      // Segunda chamada (silence_detected) deve ter sessionId
      const silenceCall = mockCreate.mock.calls.find(
        call => call[0].data.eventType === 'silence_detected'
      );

      expect(silenceCall[0].data.sessionId).toBe('test-session-456');
    });

    it('should persist events without sessionId when no session is active', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: null
        })
      });
    });

    it('should allow manual sessionId setting', () => {
      persistence.setCurrentSessionId('manual-session');
      expect(persistence.getCurrentSessionId()).toBe('manual-session');

      persistence.setCurrentSessionId(null);
      expect(persistence.getCurrentSessionId()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      persistence.start();
    });

    it('should handle Prisma errors without throwing', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Database connection failed'));

      // Should not throw
      await expect(
        eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 })
      ).resolves.not.toThrow();

      expect(persistence.getStats().errorCount).toBe(1);
      expect(persistence.getStats().persistedCount).toBe(0);
    });

    it('should continue persisting after error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Temporary error'));

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 });
      expect(persistence.getStats().errorCount).toBe(1);

      // Next event should succeed
      await eventBus.publish('silence.ended', { levelDb: -30, silenceDuration: 15 });
      expect(persistence.getStats().persistedCount).toBe(1);
      expect(persistence.getStats().errorCount).toBe(1);
    });

    it('should not persist events when stopped', async () => {
      await persistence.stop();

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 });

      expect(mockCreate).not.toHaveBeenCalled();
      expect(persistence.getStats().persistedCount).toBe(0);
    });
  });

  describe('Track Change Events', () => {
    beforeEach(() => {
      persistence.start();
    });

    it('should persist track.change.detected event', async () => {
      await eventBus.publish('track.change.detected', {
        timestamp: '2025-01-01T00:00:00.000Z',
        previousTrack: 'Track 1',
        newTrack: 'Track 2'
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          eventType: 'track_change_detected', // Enum value stored in DB
          sessionId: null,
          metadata: {
            timestamp: '2025-01-01T00:00:00.000Z',
            previousTrack: 'Track 1',
            newTrack: 'Track 2'
          },
          timestamp: expect.any(Date)
        }
      });
    });
  });

  describe('Stats Reporting', () => {
    it('should return complete stats', () => {
      persistence.start();
      persistence.setCurrentSessionId('test-session');

      const stats = persistence.getStats();

      expect(stats).toEqual({
        isRunning: true,
        persistedCount: 0,
        errorCount: 0,
        currentSessionId: 'test-session',
        subscriptionCount: 6
      });
    });

    it('should track stats after events', async () => {
      persistence.start();

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10, threshold: -50 });
      await eventBus.publish('clipping.detected', { levelDb: -0.5, threshold: -1, count: 1 });

      mockCreate.mockRejectedValueOnce(new Error('Error'));
      await eventBus.publish('silence.ended', { levelDb: -30, silenceDuration: 15 });

      const stats = persistence.getStats();

      expect(stats.persistedCount).toBe(2);
      expect(stats.errorCount).toBe(1);
    });
  });
});
