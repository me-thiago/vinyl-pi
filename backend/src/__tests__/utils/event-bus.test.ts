import { EventBus, eventBus, EventType, EventHandler } from '../../utils/event-bus';

describe('EventBus', () => {
  let testBus: EventBus;

  beforeEach(() => {
    // Create fresh instance for each test
    testBus = new EventBus();
  });

  afterEach(() => {
    // Cleanup after each test
    testBus.clearAllListeners();
  });

  describe('AC1: EventBus utility creation with pub/sub pattern', () => {
    it('should create EventBus instance', () => {
      expect(testBus).toBeInstanceOf(EventBus);
      expect(testBus.subscribe).toBeDefined();
      expect(testBus.publish).toBeDefined();
      expect(testBus.unsubscribe).toBeDefined();
    });

    it('should export singleton instance', () => {
      expect(eventBus).toBeInstanceOf(EventBus);
      expect(eventBus).toBe(eventBus); // Same reference
    });

    it('should have getListenerCount helper method', () => {
      expect(testBus.getListenerCount).toBeDefined();
      expect(testBus.getListenerCount('audio.start')).toBe(0);
    });

    it('should have clearAllListeners helper method', () => {
      expect(testBus.clearAllListeners).toBeDefined();
    });
  });

  describe('AC2: Supported events', () => {
    const supportedEvents: EventType[] = [
      'audio.start',
      'audio.stop',
      'silence.detected',
      'silence.ended',
      'turntable.idle',
      'turntable.active',
      'track.change.detected',
      'session.started',
      'session.ended',
      'clipping.detected'
    ];

    it('should support all 10 event types', async () => {
      const receivedEvents = new Set<string>();
      const handler: EventHandler = async (payload) => {
        receivedEvents.add(payload.event);
      };

      // Subscribe to all events
      supportedEvents.forEach(event => {
        testBus.subscribe(event, handler);
      });

      // Publish all events
      for (const event of supportedEvents) {
        await testBus.publish(event, { event });
      }

      // Verify all events were received
      expect(receivedEvents.size).toBe(10);
      supportedEvents.forEach(event => {
        expect(receivedEvents.has(event)).toBe(true);
      });
    });

    it('should allow publishing to events with no listeners without errors', async () => {
      await expect(testBus.publish('audio.start', {})).resolves.not.toThrow();
    });

    it('should use dot notation for event names', () => {
      supportedEvents.forEach(event => {
        expect(event).toMatch(/\./); // Contains dot
      });
    });
  });

  describe('AC3: Multiple listeners per event', () => {
    it('should support multiple subscribers for same event', () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      const handler3 = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('audio.start', handler2);
      testBus.subscribe('audio.start', handler3);

      expect(testBus.getListenerCount('audio.start')).toBe(3);
    });

    it('should execute all handlers when event is published', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      const handler3 = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('audio.start', handler2);
      testBus.subscribe('audio.start', handler3);

      const payload = { timestamp: new Date().toISOString() };
      await testBus.publish('audio.start', payload);

      expect(handler1).toHaveBeenCalledWith(payload);
      expect(handler2).toHaveBeenCalledWith(payload);
      expect(handler3).toHaveBeenCalledWith(payload);
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('should execute handlers in parallel (Promise.all)', async () => {
      const executionOrder: number[] = [];

      const handler1: EventHandler = async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        executionOrder.push(1);
      };

      const handler2: EventHandler = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionOrder.push(2);
      };

      const handler3: EventHandler = async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
        executionOrder.push(3);
      };

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('audio.start', handler2);
      testBus.subscribe('audio.start', handler3);

      const startTime = Date.now();
      await testBus.publish('audio.start', {});
      const duration = Date.now() - startTime;

      // Should complete in ~30ms (longest handler), not ~60ms (sequential)
      expect(duration).toBeLessThan(50);

      // Handler 2 (fastest) should complete first
      expect(executionOrder[0]).toBe(2);
    });
  });

  describe('AC4: Serializable payload (plain object)', () => {
    it('should accept plain objects as payload', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      testBus.subscribe('audio.start', handler);

      const payload = {
        timestamp: new Date().toISOString(),
        device: 'plughw:1,0',
        sampleRate: 48000,
        nested: {
          deep: {
            value: 123
          }
        }
      };

      await testBus.publish('audio.start', payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it('should support JSON.stringify on payloads', async () => {
      let receivedPayload: Record<string, any> | null = null;
      const handler: EventHandler = async (payload) => {
        receivedPayload = payload;
      };

      testBus.subscribe('silence.detected', handler);

      const payload = {
        timestamp: '2025-11-07T10:00:00Z',
        level_db: -45.5,
        duration: 10.2
      };

      await testBus.publish('silence.detected', payload);

      expect(receivedPayload).not.toBeNull();
      expect(() => JSON.stringify(receivedPayload!)).not.toThrow();

      const serialized = JSON.stringify(receivedPayload);
      const deserialized = JSON.parse(serialized);
      expect(deserialized).toEqual(payload);
    });

    it('should handle empty payloads', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      testBus.subscribe('audio.stop', handler);

      await testBus.publish('audio.stop', {});

      expect(handler).toHaveBeenCalledWith({});
    });
  });

  describe('AC5: Async handlers with exception handling', () => {
    it('should support async handlers', async () => {
      const asyncHandler: EventHandler = async (payload) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(payload.test).toBe(true);
      };

      testBus.subscribe('audio.start', asyncHandler);

      await testBus.publish('audio.start', { test: true });
    });

    it('should catch exceptions in handlers and not propagate them', async () => {
      const errorHandler: EventHandler = async () => {
        throw new Error('Test error - should be caught');
      };

      const goodHandler = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', errorHandler);
      testBus.subscribe('audio.start', goodHandler);

      // Should not throw even though errorHandler throws
      await expect(testBus.publish('audio.start', {})).resolves.not.toThrow();

      // Good handler should still execute
      expect(goodHandler).toHaveBeenCalled();
    });

    it('should not stop other handlers when one fails', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2: EventHandler = async () => {
        throw new Error('Handler 2 fails');
      };
      const handler3 = jest.fn().mockResolvedValue(undefined);
      const handler4: EventHandler = async () => {
        throw new Error('Handler 4 fails');
      };
      const handler5 = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('audio.start', handler2);
      testBus.subscribe('audio.start', handler3);
      testBus.subscribe('audio.start', handler4);
      testBus.subscribe('audio.start', handler5);

      await testBus.publish('audio.start', {});

      // All good handlers should execute despite errors in handler2 and handler4
      expect(handler1).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
      expect(handler5).toHaveBeenCalled();
    });

    it('should handle Promise rejections in handlers', async () => {
      const rejectingHandler: EventHandler = async () => {
        return Promise.reject(new Error('Promise rejected'));
      };

      const goodHandler = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', rejectingHandler);
      testBus.subscribe('audio.start', goodHandler);

      await expect(testBus.publish('audio.start', {})).resolves.not.toThrow();
      expect(goodHandler).toHaveBeenCalled();
    });
  });

  describe('Unsubscribe functionality', () => {
    it('should remove handler when unsubscribed', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler);
      expect(testBus.getListenerCount('audio.start')).toBe(1);

      testBus.unsubscribe('audio.start', handler);
      expect(testBus.getListenerCount('audio.start')).toBe(0);

      await testBus.publish('audio.start', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should only remove specified handler, not others', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      const handler3 = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('audio.start', handler2);
      testBus.subscribe('audio.start', handler3);

      expect(testBus.getListenerCount('audio.start')).toBe(3);

      testBus.unsubscribe('audio.start', handler2);
      expect(testBus.getListenerCount('audio.start')).toBe(2);

      await testBus.publish('audio.start', {});

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });

    it('should handle unsubscribing non-existent handler gracefully', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      expect(() => {
        testBus.unsubscribe('audio.start', handler);
      }).not.toThrow();
    });

    it('should cleanup empty event sets after unsubscribe', () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler);
      testBus.unsubscribe('audio.start', handler);

      // Event should be removed from listeners map
      expect(testBus.getListenerCount('audio.start')).toBe(0);
    });
  });

  describe('Performance and memory', () => {
    it('should handle multiple rapid publishes correctly', async () => {
      let callCount = 0;
      const handler: EventHandler = async () => {
        callCount++;
      };

      testBus.subscribe('audio.start', handler);

      // Publish 100 events rapidly
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(testBus.publish('audio.start', { index: i }));
      }

      await Promise.all(promises);

      expect(callCount).toBe(100);
    });

    it('should not leak memory with many handlers', () => {
      const handlers: EventHandler[] = [];

      // Register up to the limit (50 handlers)
      // This tests that cleanup works properly for many handlers
      for (let i = 0; i < 50; i++) {
        const handler: EventHandler = async () => {};
        handlers.push(handler);
        testBus.subscribe('audio.start', handler);
      }

      expect(testBus.getListenerCount('audio.start')).toBe(50);

      // Unsubscribe all
      handlers.forEach(handler => {
        testBus.unsubscribe('audio.start', handler);
      });

      expect(testBus.getListenerCount('audio.start')).toBe(0);
    });

    it('should throw error when exceeding max listeners', () => {
      const handlers: EventHandler[] = [];

      // Register up to the limit (50 handlers)
      for (let i = 0; i < 50; i++) {
        const handler: EventHandler = async () => {};
        handlers.push(handler);
        testBus.subscribe('audio.start', handler);
      }

      // Attempt to register 51st handler should throw
      const extraHandler: EventHandler = async () => {};
      expect(() => {
        testBus.subscribe('audio.start', extraHandler);
      }).toThrow(/Too many listeners/);

      expect(testBus.getListenerCount('audio.start')).toBe(50);
    });

    it('should clear all listeners with clearAllListeners()', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('silence.detected', handler2);

      expect(testBus.getListenerCount('audio.start')).toBe(1);
      expect(testBus.getListenerCount('silence.detected')).toBe(1);

      testBus.clearAllListeners();

      expect(testBus.getListenerCount('audio.start')).toBe(0);
      expect(testBus.getListenerCount('silence.detected')).toBe(0);

      await testBus.publish('audio.start', {});
      await testBus.publish('silence.detected', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });
  });

  describe('Integration scenarios', () => {
    it('should work with real-world event flow', async () => {
      const events: string[] = [];

      // Simulate AudioManager subscribing to events
      const audioManagerHandler: EventHandler = async (payload) => {
        events.push(`audio-manager received: ${payload.event}`);
      };

      // Simulate EventDetector subscribing
      const eventDetectorHandler: EventHandler = async (payload) => {
        events.push(`event-detector received: ${payload.event}`);
      };

      testBus.subscribe('audio.start', audioManagerHandler);
      testBus.subscribe('audio.start', eventDetectorHandler);
      testBus.subscribe('silence.detected', eventDetectorHandler);

      // Simulate event flow
      await testBus.publish('audio.start', { event: 'audio.start' });
      await testBus.publish('silence.detected', { event: 'silence.detected' });

      expect(events).toEqual([
        'audio-manager received: audio.start',
        'event-detector received: audio.start',
        'event-detector received: silence.detected'
      ]);
    });

    it('should support event chaining (handler publishes another event)', async () => {
      const receivedEvents: string[] = [];

      const handler1: EventHandler = async (payload) => {
        receivedEvents.push('handler1: audio.start');
        // Handler publishes another event
        await testBus.publish('turntable.active', { trigger: 'audio.start' });
      };

      const handler2: EventHandler = async (payload) => {
        receivedEvents.push('handler2: turntable.active');
      };

      testBus.subscribe('audio.start', handler1);
      testBus.subscribe('turntable.active', handler2);

      await testBus.publish('audio.start', {});

      expect(receivedEvents).toEqual([
        'handler1: audio.start',
        'handler2: turntable.active'
      ]);
    });
  });
});
