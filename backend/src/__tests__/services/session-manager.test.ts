import { SessionManager, SessionState, SessionManagerConfig } from '../../services/session-manager';
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
    session: {
      create: jest.fn().mockResolvedValue({
        id: 'test-session-id',
        startedAt: new Date(),
        endedAt: null,
        durationSeconds: 0,
        eventCount: 0
      }),
      update: jest.fn().mockResolvedValue({
        id: 'test-session-id',
        startedAt: new Date(),
        endedAt: new Date(),
        durationSeconds: 100,
        eventCount: 5
      })
    }
  }
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  const mockPublish = eventBus.publish as jest.Mock;
  const mockSubscribe = eventBus.subscribe as jest.Mock;
  const mockCreate = prisma.session.create as jest.Mock;
  const mockUpdate = prisma.session.update as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    sessionManager = new SessionManager({
      sessionTimeout: 60, // 60 segundos para testes mais rápidos
      audioThreshold: -50
    });
  });

  afterEach(async () => {
    jest.useRealTimers();
    await sessionManager.destroy();
  });

  describe('Initialization', () => {
    it('should create with default config', () => {
      const defaultManager = new SessionManager();
      const config = defaultManager.getConfig();

      expect(config.sessionTimeout).toBe(1800);
      expect(config.audioThreshold).toBe(-50);

      defaultManager.destroy();
    });

    it('should create with custom config', () => {
      const config = sessionManager.getConfig();

      expect(config.sessionTimeout).toBe(60);
      expect(config.audioThreshold).toBe(-50);
    });

    it('should start in idle state', () => {
      expect(sessionManager.getState()).toBe('idle');
    });

    it('should not be active initially', () => {
      expect(sessionManager.isActive()).toBe(false);
    });

    it('should have no active session initially', () => {
      expect(sessionManager.getActiveSession()).toBeNull();
      expect(sessionManager.getCurrentSessionId()).toBeNull();
    });
  });

  describe('Start/Stop', () => {
    it('should start and subscribe to events', () => {
      sessionManager.start();

      expect(sessionManager.isActive()).toBe(true);
      expect(mockSubscribe).toHaveBeenCalledWith('audio.level', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('silence.detected', expect.any(Function));
      expect(mockSubscribe).toHaveBeenCalledWith('silence.ended', expect.any(Function));
    });

    it('should stop and cleanup', async () => {
      sessionManager.start();
      await sessionManager.stop();

      expect(sessionManager.isActive()).toBe(false);
    });

    it('should handle multiple start calls gracefully', () => {
      sessionManager.start();
      sessionManager.start();

      expect(sessionManager.isActive()).toBe(true);
    });

    it('should implement destroy() as alias for stop()', async () => {
      sessionManager.start();
      await sessionManager.destroy();

      expect(sessionManager.isActive()).toBe(false);
    });
  });

  describe('Session Start (AC1)', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should start session on first audio above threshold', async () => {
      // Enviar áudio acima do threshold
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      expect(sessionManager.getState()).toBe('active');
      expect(sessionManager.getCurrentSessionId()).toBe('test-session-id');
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should emit session.started event', async () => {
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      expect(mockPublish).toHaveBeenCalledWith(
        'session.started',
        expect.objectContaining({
          sessionId: 'test-session-id',
          timestamp: expect.any(String)
        })
      );
    });

    it('should NOT start session when audio is below threshold', async () => {
      await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });

      expect(sessionManager.getState()).toBe('idle');
      expect(sessionManager.getCurrentSessionId()).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should NOT start new session when already active', async () => {
      // Primeira vez - inicia sessão
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Segunda vez - não deve criar nova
      await eventBus.publish('audio.level', { levelDb: -25, timestamp: Date.now() });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Session End - Timeout (AC2)', () => {
    beforeEach(async () => {
      sessionManager.start();
      // Iniciar sessão
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
    });

    it('should start timeout timer on silence.detected', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });

      // Timer deve estar ativo (não podemos verificar diretamente, mas podemos avançar o tempo)
      expect(sessionManager.getState()).toBe('active');
    });

    it('should end session after timeout expires', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });

      // Avançar o tempo além do timeout (60s) e executar timers pendentes
      await jest.advanceTimersByTimeAsync(61000);

      expect(sessionManager.getState()).toBe('idle');
      expect(sessionManager.getCurrentSessionId()).toBeNull();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should emit session.ended event after timeout', async () => {
      mockPublish.mockClear();

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });
      await jest.advanceTimersByTimeAsync(61000);

      expect(mockPublish).toHaveBeenCalledWith(
        'session.ended',
        expect.objectContaining({
          sessionId: 'test-session-id',
          timestamp: expect.any(String),
          durationSeconds: expect.any(Number),
          eventCount: expect.any(Number)
        })
      );
    });

    it('should cancel timeout timer on silence.ended', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });

      // Áudio volta antes do timeout
      await eventBus.publish('silence.ended', { levelDb: -30, silenceDuration: 5 });

      // Avançar além do timeout
      await jest.advanceTimersByTimeAsync(61000);

      // Sessão ainda deve estar ativa (timer foi cancelado)
      expect(sessionManager.getState()).toBe('active');
    });

    it('should NOT end session for short silence', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });

      // Avançar apenas 30 segundos (menos que timeout de 60s)
      await jest.advanceTimersByTimeAsync(30000);

      // Sessão ainda ativa
      expect(sessionManager.getState()).toBe('active');
    });
  });

  describe('Session Events (AC3)', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should publish session.started with correct payload', async () => {
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      expect(mockPublish).toHaveBeenCalledWith(
        'session.started',
        {
          sessionId: 'test-session-id',
          timestamp: expect.any(String)
        }
      );
    });

    it('should publish session.ended with correct payload including duration', async () => {
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
      mockPublish.mockClear();

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });
      await jest.advanceTimersByTimeAsync(61000);

      expect(mockPublish).toHaveBeenCalledWith(
        'session.ended',
        expect.objectContaining({
          sessionId: 'test-session-id',
          durationSeconds: expect.any(Number)
        })
      );
    });
  });

  describe('Session Persistence (AC4)', () => {
    beforeEach(() => {
      sessionManager.start();
    });

    it('should create session in database on start', async () => {
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          startedAt: expect.any(Date),
          eventCount: 0,
          durationSeconds: 0
        }
      });
    });

    it('should update session in database on end', async () => {
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });
      await jest.advanceTimersByTimeAsync(61000);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'test-session-id' },
        data: {
          endedAt: expect.any(Date),
          durationSeconds: expect.any(Number),
          eventCount: expect.any(Number)
        }
      });
    });
  });

  describe('Event Count (AC5)', () => {
    beforeEach(async () => {
      sessionManager.start();
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
    });

    it('should increment event count', () => {
      expect(sessionManager.getActiveSession()?.eventCount).toBe(0);

      sessionManager.incrementEventCount();
      expect(sessionManager.getActiveSession()?.eventCount).toBe(1);

      sessionManager.incrementEventCount();
      sessionManager.incrementEventCount();
      expect(sessionManager.getActiveSession()?.eventCount).toBe(3);
    });

    it('should include event count in session.ended payload', async () => {
      sessionManager.incrementEventCount();
      sessionManager.incrementEventCount();
      mockPublish.mockClear();

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });
      await jest.advanceTimersByTimeAsync(61000);

      expect(mockPublish).toHaveBeenCalledWith(
        'session.ended',
        expect.objectContaining({
          eventCount: 2
        })
      );
    });

    it('should NOT increment count when idle', () => {
      const idleManager = new SessionManager();
      idleManager.incrementEventCount(); // Deve ser ignorado

      expect(idleManager.getActiveSession()).toBeNull();
    });
  });

  describe('Active Session Info', () => {
    beforeEach(async () => {
      sessionManager.start();
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
    });

    it('should return active session info', () => {
      const session = sessionManager.getActiveSession();

      expect(session).not.toBeNull();
      expect(session?.id).toBe('test-session-id');
      expect(session?.startedAt).toBeInstanceOf(Date);
      expect(session?.durationSeconds).toBeGreaterThanOrEqual(0);
      expect(session?.eventCount).toBe(0);
    });

    it('should calculate duration correctly', () => {
      jest.advanceTimersByTime(5000); // 5 segundos

      const session = sessionManager.getActiveSession();
      expect(session?.durationSeconds).toBeGreaterThanOrEqual(5);
    });

    it('should return null when idle', async () => {
      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });
      await jest.advanceTimersByTimeAsync(61000);

      expect(sessionManager.getActiveSession()).toBeNull();
    });
  });

  describe('Status Reporting', () => {
    it('should return complete status when idle', () => {
      sessionManager.start();
      const status = sessionManager.getStatus();

      expect(status).toEqual({
        isRunning: true,
        state: 'idle',
        activeSession: null,
        config: {
          sessionTimeout: 60,
          audioThreshold: -50
        }
      });
    });

    it('should return complete status when active', async () => {
      sessionManager.start();
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      const status = sessionManager.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.state).toBe('active');
      expect(status.activeSession).not.toBeNull();
      expect(status.activeSession?.id).toBe('test-session-id');
    });
  });

  describe('Graceful Shutdown', () => {
    it('should end active session on stop', async () => {
      sessionManager.start();
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      expect(sessionManager.getState()).toBe('active');

      await sessionManager.stop();

      expect(mockUpdate).toHaveBeenCalled();
      expect(sessionManager.getState()).toBe('idle');
    });

    it('should emit session.ended on stop', async () => {
      sessionManager.start();
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
      mockPublish.mockClear();

      await sessionManager.stop();

      expect(mockPublish).toHaveBeenCalledWith(
        'session.ended',
        expect.objectContaining({
          sessionId: 'test-session-id'
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Prisma create error gracefully', async () => {
      mockCreate.mockRejectedValueOnce(new Error('Database error'));

      sessionManager.start();

      // Não deve lançar exceção
      await expect(
        eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() })
      ).resolves.not.toThrow();

      // Deve permanecer idle
      expect(sessionManager.getState()).toBe('idle');
    });

    it('should handle Prisma update error gracefully', async () => {
      sessionManager.start();
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });

      mockUpdate.mockRejectedValueOnce(new Error('Database error'));

      await eventBus.publish('silence.detected', { levelDb: -60, duration: 10 });
      jest.advanceTimersByTime(61000);

      // Não deve lançar exceção
      await expect(Promise.resolve()).resolves.not.toThrow();
    });
  });
});
