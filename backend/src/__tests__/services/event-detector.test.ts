import { EventDetector, SilenceDetectionConfig, ClippingDetectionConfig } from '../../services/event-detector';
import { eventBus } from '../../utils/event-bus';

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

describe('EventDetector', () => {
  let detector: EventDetector;
  const mockPublish = eventBus.publish as jest.Mock;
  const mockSubscribe = eventBus.subscribe as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    detector = new EventDetector({
      threshold: -50,
      duration: 1  // 1 segundo para testes mais rápidos
    });
  });

  afterEach(async () => {
    await detector.stop();
  });

  describe('Initialization', () => {
    it('should create with default config', () => {
      const defaultDetector = new EventDetector();
      const config = defaultDetector.getConfig();
      const clippingConfig = defaultDetector.getClippingConfig();

      expect(config.threshold).toBe(-50);
      expect(config.duration).toBe(10);
      expect(clippingConfig.threshold).toBe(-1);

      defaultDetector.stop();
    });

    it('should create with custom config (legacy format)', () => {
      const config = detector.getConfig();

      expect(config.threshold).toBe(-50);
      expect(config.duration).toBe(1);
    });

    it('should create with new config format', () => {
      const newDetector = new EventDetector({
        silence: { threshold: -40, duration: 5 },
        clipping: { threshold: -2 }
      });

      expect(newDetector.getConfig().threshold).toBe(-40);
      expect(newDetector.getConfig().duration).toBe(5);
      expect(newDetector.getClippingConfig().threshold).toBe(-2);

      newDetector.stop();
    });

    it('should not be active initially', () => {
      expect(detector.isActive()).toBe(false);
    });

    it('should not be in silence state initially', () => {
      expect(detector.getSilenceStatus()).toBe(false);
    });

    it('should have zero clipping count initially', () => {
      expect(detector.getClippingCount()).toBe(0);
    });
  });

  describe('Start/Stop', () => {
    it('should start detector and subscribe to audio.level', () => {
      detector.start();
      
      expect(detector.isActive()).toBe(true);
      expect(mockSubscribe).toHaveBeenCalledWith(
        'audio.level',
        expect.any(Function)
      );
    });

    it('should stop detector', async () => {
      detector.start();
      await detector.stop();
      
      expect(detector.isActive()).toBe(false);
    });

    it('should handle multiple start calls gracefully', () => {
      detector.start();
      detector.start(); // Should not throw
      expect(detector.isActive()).toBe(true);
    });

    it('should reset state on stop', async () => {
      detector.start();

      // Simulate silence detection
      await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });

      await detector.stop();

      expect(detector.getSilenceStatus()).toBe(false);
    });

    it('should reset clipping count on stop', async () => {
      detector.start();

      // Trigger clipping
      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });
      expect(detector.getClippingCount()).toBe(1);

      await detector.stop();
      expect(detector.getClippingCount()).toBe(0);
    });
  });

  describe('Silence Detection', () => {
    beforeEach(() => {
      detector.start();
    });

    it('should not detect silence immediately', async () => {
      // Send one event below threshold
      await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
      
      // Should not be in silence yet (duration not reached)
      expect(detector.getSilenceStatus()).toBe(false);
      expect(mockPublish).not.toHaveBeenCalledWith(
        'silence.detected',
        expect.anything()
      );
    });

    it('should detect silence after duration threshold', async () => {
      const startTime = Date.now();
      
      // Send events below threshold for more than duration
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { 
          levelDb: -60, 
          timestamp: startTime + (i * 100) 
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Should now be in silence
      expect(detector.getSilenceStatus()).toBe(true);
      expect(mockPublish).toHaveBeenCalledWith(
        'silence.detected',
        expect.objectContaining({
          timestamp: expect.any(String),
          levelDb: expect.any(Number),
          duration: expect.any(Number),
          threshold: -50
        })
      );
    });

    it('should not emit silence.detected for audio above threshold', async () => {
      // Send events above threshold
      for (let i = 0; i < 20; i++) {
        await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      expect(detector.getSilenceStatus()).toBe(false);
      expect(mockPublish).not.toHaveBeenCalledWith(
        'silence.detected',
        expect.anything()
      );
    });

    it('should emit silence.ended when audio returns', async () => {
      // First, trigger silence detection
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      expect(detector.getSilenceStatus()).toBe(true);
      mockPublish.mockClear();
      
      // Now send audio above threshold
      await eventBus.publish('audio.level', { levelDb: -30, timestamp: Date.now() });
      
      // Should have emitted silence.ended
      expect(detector.getSilenceStatus()).toBe(false);
      expect(mockPublish).toHaveBeenCalledWith(
        'silence.ended',
        expect.objectContaining({
          timestamp: expect.any(String),
          levelDb: -30,
          silenceDuration: expect.any(Number)
        })
      );
    });

    it('should handle threshold at exactly -50dB', async () => {
      // -50dB is exactly at threshold, should NOT be considered silence
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { levelDb: -50, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // -50 is NOT below -50, so no silence
      expect(detector.getSilenceStatus()).toBe(false);
    });

    it('should detect silence at -50.1dB (just below threshold)', async () => {
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { levelDb: -50.1, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      expect(detector.getSilenceStatus()).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(() => {
      detector.start();
    });

    it('should update threshold', () => {
      detector.setThreshold(-40);
      expect(detector.getConfig().threshold).toBe(-40);
    });

    it('should update duration', () => {
      detector.setDuration(5);
      expect(detector.getConfig().duration).toBe(5);
    });

    it('should use new threshold for detection', async () => {
      // Set stricter threshold
      detector.setThreshold(-70);
      
      // -60dB is now above threshold, should not trigger silence
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      expect(detector.getSilenceStatus()).toBe(false);
    });
  });

  describe('Status Reporting', () => {
    it('should return complete status', () => {
      detector.start();

      const status = detector.getStatus();

      expect(status).toEqual({
        isRunning: true,
        isSilent: false,
        lastLevelDb: -100,
        clippingCount: 0,
        config: {
          threshold: -50,
          duration: 1
        },
        clippingConfig: {
          threshold: -1
        }
      });
    });

    it('should update lastLevelDb after receiving events', async () => {
      detector.start();

      await eventBus.publish('audio.level', { levelDb: -35, timestamp: Date.now() });

      expect(detector.getLastLevelDb()).toBe(-35);
    });

    it('should include clipping count in status', async () => {
      detector.start();

      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });
      await eventBus.publish('audio.level', { levelDb: -0.3, timestamp: Date.now() });

      const status = detector.getStatus();
      expect(status.clippingCount).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      detector.start();
    });

    it('should handle rapid transitions', async () => {
      // Rapid alternation between silence and audio
      for (let i = 0; i < 20; i++) {
        const level = i % 2 === 0 ? -60 : -30;
        await eventBus.publish('audio.level', { levelDb: level, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Should not be in silence due to interruptions
      expect(detector.getSilenceStatus()).toBe(false);
    });

    it('should not emit duplicate silence.detected events', async () => {
      // Trigger silence
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const silenceDetectedCalls = mockPublish.mock.calls.filter(
        call => call[0] === 'silence.detected'
      );
      
      // Should only emit once
      expect(silenceDetectedCalls.length).toBe(1);
      
      // Continue sending silence
      mockPublish.mockClear();
      for (let i = 0; i < 10; i++) {
        await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Should not emit again
      const additionalCalls = mockPublish.mock.calls.filter(
        call => call[0] === 'silence.detected'
      );
      expect(additionalCalls.length).toBe(0);
    });

    it('should handle events when not running', async () => {
      await detector.stop();
      
      // This should not throw
      await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
      
      expect(detector.getSilenceStatus()).toBe(false);
    });
  });

  describe('Destroyable Interface', () => {
    it('should implement destroy() as alias for stop()', async () => {
      detector.start();
      expect(detector.isActive()).toBe(true);

      await detector.destroy();

      expect(detector.isActive()).toBe(false);
    });
  });

  describe('Clipping Detection', () => {
    beforeEach(() => {
      detector.start();
    });

    it('should detect clipping when level exceeds threshold', async () => {
      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(1);
      expect(mockPublish).toHaveBeenCalledWith(
        'clipping.detected',
        expect.objectContaining({
          timestamp: expect.any(String),
          levelDb: -0.5,
          threshold: -1,
          count: 1
        })
      );
    });

    it('should not detect clipping when level is below threshold', async () => {
      await eventBus.publish('audio.level', { levelDb: -5, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(0);
      expect(mockPublish).not.toHaveBeenCalledWith(
        'clipping.detected',
        expect.anything()
      );
    });

    it('should count multiple clipping events', async () => {
      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });
      await eventBus.publish('audio.level', { levelDb: -0.3, timestamp: Date.now() });
      await eventBus.publish('audio.level', { levelDb: -0.1, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(3);
    });

    it('should include correct count in each clipping event', async () => {
      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });
      await eventBus.publish('audio.level', { levelDb: -0.3, timestamp: Date.now() });

      const clippingCalls = mockPublish.mock.calls.filter(
        call => call[0] === 'clipping.detected'
      );

      expect(clippingCalls[0][1].count).toBe(1);
      expect(clippingCalls[1][1].count).toBe(2);
    });

    it('should handle threshold at exactly -1dB', async () => {
      // -1dB is exactly at threshold, should NOT be considered clipping
      await eventBus.publish('audio.level', { levelDb: -1, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(0);
    });

    it('should detect clipping at -0.9dB (just above threshold)', async () => {
      await eventBus.publish('audio.level', { levelDb: -0.9, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(1);
    });

    it('should detect clipping at 0dB (max level)', async () => {
      await eventBus.publish('audio.level', { levelDb: 0, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(1);
      expect(mockPublish).toHaveBeenCalledWith(
        'clipping.detected',
        expect.objectContaining({
          levelDb: 0,
          threshold: -1
        })
      );
    });
  });

  describe('Clipping Configuration', () => {
    beforeEach(() => {
      detector.start();
    });

    it('should update clipping threshold', () => {
      detector.setClippingThreshold(-2);
      expect(detector.getClippingConfig().threshold).toBe(-2);
    });

    it('should use new threshold for detection', async () => {
      // Set stricter threshold
      detector.setClippingThreshold(-3);

      // -2dB is now below threshold, should trigger clipping
      await eventBus.publish('audio.level', { levelDb: -2, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(1);
    });

    it('should not detect with stricter threshold when level is below', async () => {
      // Set stricter threshold
      detector.setClippingThreshold(-0.5);

      // -0.8dB is now below threshold, should NOT trigger clipping
      await eventBus.publish('audio.level', { levelDb: -0.8, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(0);
    });
  });

  describe('Combined Silence and Clipping', () => {
    beforeEach(() => {
      detector.start();
    });

    it('should detect both silence and clipping independently', async () => {
      // First trigger clipping
      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });
      expect(detector.getClippingCount()).toBe(1);

      // Then trigger silence
      for (let i = 0; i < 15; i++) {
        await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      expect(detector.getSilenceStatus()).toBe(true);
      expect(detector.getClippingCount()).toBe(1); // Count preserved
    });

    it('should handle rapid transitions between normal, silence, and clipping', async () => {
      // Clipping
      await eventBus.publish('audio.level', { levelDb: -0.5, timestamp: Date.now() });
      // Normal
      await eventBus.publish('audio.level', { levelDb: -20, timestamp: Date.now() });
      // More clipping
      await eventBus.publish('audio.level', { levelDb: -0.3, timestamp: Date.now() });
      // Very quiet (but not silence yet)
      await eventBus.publish('audio.level', { levelDb: -60, timestamp: Date.now() });

      expect(detector.getClippingCount()).toBe(2);
      expect(detector.getSilenceStatus()).toBe(false); // Not silent yet (duration not met)
    });
  });
});

