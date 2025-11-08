import { eventBus } from '../../utils/event-bus';
import { 
  createSubscriptionManager, 
  Destroyable, 
  DestroyableComponent,
  SubscriptionManager
} from '../../utils/lifecycle';

describe('Lifecycle Utilities', () => {
  // Clean up after each test
  afterEach(() => {
    eventBus.clearAllListeners();
  });

  describe('createSubscriptionManager', () => {
    it('should create a subscription manager', () => {
      const manager = createSubscriptionManager();
      
      expect(manager).toBeDefined();
      expect(manager.subscribe).toBeDefined();
      expect(manager.cleanup).toBeDefined();
      expect(manager.getSubscriptionCount).toBeDefined();
    });

    it('should subscribe handlers to EventBus', async () => {
      const manager = createSubscriptionManager();
      const handler = jest.fn().mockResolvedValue(undefined);

      manager.subscribe('test.event', handler);

      // Verify handler was registered with EventBus
      expect(eventBus.getListenerCount('test.event')).toBe(1);

      // Verify handler is called when event is published
      await eventBus.publish('test.event', { data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should track subscription count', () => {
      const manager = createSubscriptionManager();

      expect(manager.getSubscriptionCount()).toBe(0);

      manager.subscribe('event1', jest.fn().mockResolvedValue(undefined));
      expect(manager.getSubscriptionCount()).toBe(1);

      manager.subscribe('event2', jest.fn().mockResolvedValue(undefined));
      expect(manager.getSubscriptionCount()).toBe(2);

      manager.subscribe('event1', jest.fn().mockResolvedValue(undefined));
      expect(manager.getSubscriptionCount()).toBe(3);
    });

    it('should cleanup all subscriptions', async () => {
      const manager = createSubscriptionManager();
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);
      const handler3 = jest.fn().mockResolvedValue(undefined);

      manager.subscribe('event1', handler1);
      manager.subscribe('event2', handler2);
      manager.subscribe('event3', handler3);

      // Verify all registered
      expect(eventBus.getListenerCount('event1')).toBe(1);
      expect(eventBus.getListenerCount('event2')).toBe(1);
      expect(eventBus.getListenerCount('event3')).toBe(1);
      expect(manager.getSubscriptionCount()).toBe(3);

      // Cleanup
      manager.cleanup();

      // Verify all unregistered
      expect(eventBus.getListenerCount('event1')).toBe(0);
      expect(eventBus.getListenerCount('event2')).toBe(0);
      expect(eventBus.getListenerCount('event3')).toBe(0);
      expect(manager.getSubscriptionCount()).toBe(0);

      // Verify handlers are not called after cleanup
      await eventBus.publish('event1', {});
      await eventBus.publish('event2', {});
      await eventBus.publish('event3', {});

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should handle multiple subscriptions to same event', async () => {
      const manager = createSubscriptionManager();
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      manager.subscribe('test.event', handler1);
      manager.subscribe('test.event', handler2);

      expect(eventBus.getListenerCount('test.event')).toBe(2);

      await eventBus.publish('test.event', { data: 'test' });

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);

      manager.cleanup();

      expect(eventBus.getListenerCount('test.event')).toBe(0);
    });

    it('should be safe to call cleanup multiple times', () => {
      const manager = createSubscriptionManager();
      
      manager.subscribe('test.event', jest.fn().mockResolvedValue(undefined));
      
      expect(() => {
        manager.cleanup();
        manager.cleanup();
        manager.cleanup();
      }).not.toThrow();

      expect(manager.getSubscriptionCount()).toBe(0);
    });

    it('should clear internal state after cleanup', () => {
      const manager = createSubscriptionManager();
      
      manager.subscribe('event1', jest.fn().mockResolvedValue(undefined));
      manager.subscribe('event2', jest.fn().mockResolvedValue(undefined));
      
      expect(manager.getSubscriptionCount()).toBe(2);
      
      manager.cleanup();
      
      expect(manager.getSubscriptionCount()).toBe(0);
      
      // Verify can reuse manager after cleanup
      manager.subscribe('event3', jest.fn().mockResolvedValue(undefined));
      expect(manager.getSubscriptionCount()).toBe(1);
      expect(eventBus.getListenerCount('event3')).toBe(1);
    });
  });

  describe('Integration with EventBus', () => {
    it('should prevent memory leaks in short-lived components', async () => {
      class ShortLivedService implements Destroyable {
        private subscriptions = createSubscriptionManager();
        public callCount = 0;

        constructor() {
          this.subscriptions.subscribe('test.event', async () => {
            this.callCount++;
          });
        }

        async destroy(): Promise<void> {
          this.subscriptions.cleanup();
        }
      }

      // Create and destroy multiple instances
      const service1 = new ShortLivedService();
      const service2 = new ShortLivedService();
      const service3 = new ShortLivedService();

      // All 3 should receive event
      await eventBus.publish('test.event', {});
      expect(service1.callCount).toBe(1);
      expect(service2.callCount).toBe(1);
      expect(service3.callCount).toBe(1);

      // Destroy service1
      await service1.destroy();

      // Only service2 and service3 should receive event
      await eventBus.publish('test.event', {});
      expect(service1.callCount).toBe(1); // Still 1
      expect(service2.callCount).toBe(2);
      expect(service3.callCount).toBe(2);

      // Destroy service2 and service3
      await service2.destroy();
      await service3.destroy();

      // No services should receive event
      await eventBus.publish('test.event', {});
      expect(service1.callCount).toBe(1);
      expect(service2.callCount).toBe(2);
      expect(service3.callCount).toBe(2);

      // EventBus should have no listeners
      expect(eventBus.getListenerCount('test.event')).toBe(0);
    });

    it('should handle complex multi-event subscriptions', async () => {
      class ComplexService implements Destroyable {
        private subscriptions = createSubscriptionManager();
        public events: string[] = [];

        constructor() {
          this.subscriptions.subscribe('audio.start', async (p) => {
            this.events.push('audio.start');
          });

          this.subscriptions.subscribe('audio.stop', async (p) => {
            this.events.push('audio.stop');
          });

          this.subscriptions.subscribe('silence.detected', async (p) => {
            this.events.push('silence.detected');
          });
        }

        async destroy(): Promise<void> {
          this.subscriptions.cleanup();
        }
      }

      const service = new ComplexService();

      await eventBus.publish('audio.start', {});
      await eventBus.publish('silence.detected', {});
      await eventBus.publish('audio.stop', {});

      expect(service.events).toEqual([
        'audio.start',
        'silence.detected',
        'audio.stop'
      ]);

      await service.destroy();

      // After destroy, no more events should be received
      await eventBus.publish('audio.start', {});
      await eventBus.publish('silence.detected', {});

      expect(service.events).toEqual([
        'audio.start',
        'silence.detected',
        'audio.stop'
      ]); // No new events
    });
  });

  describe('DestroyableComponent base class', () => {
    it('should provide subscriptions manager automatically', () => {
      class TestComponent extends DestroyableComponent {
        // Just extend the class
      }

      const component = new TestComponent();
      
      expect(component['subscriptions']).toBeDefined();
      expect(component['subscriptions'].subscribe).toBeDefined();
      expect(component['subscriptions'].cleanup).toBeDefined();
    });

    it('should cleanup subscriptions in destroy()', async () => {
      class TestComponent extends DestroyableComponent {
        public callCount = 0;

        constructor() {
          super();
          
          this.subscriptions.subscribe('test.event', async () => {
            this.callCount++;
          });
        }
      }

      const component = new TestComponent();

      await eventBus.publish('test.event', {});
      expect(component.callCount).toBe(1);

      await component.destroy();

      await eventBus.publish('test.event', {});
      expect(component.callCount).toBe(1); // No increase after destroy
    });

    it('should allow subclasses to extend destroy()', async () => {
      class TestComponent extends DestroyableComponent {
        public cleanupCalled = false;

        addSubscription() {
          this.subscriptions.subscribe('test.event', jest.fn().mockResolvedValue(undefined));
        }

        async destroy(): Promise<void> {
          // Call parent destroy
          await super.destroy();
          
          // Add custom cleanup
          this.cleanupCalled = true;
        }
      }

      const component = new TestComponent();
      component.addSubscription();
      
      expect(eventBus.getListenerCount('test.event')).toBe(1);
      expect(component.cleanupCalled).toBe(false);

      await component.destroy();

      expect(eventBus.getListenerCount('test.event')).toBe(0);
      expect(component.cleanupCalled).toBe(true);
    });

    it('should support multiple subscriptions via base class', async () => {
      class MultiEventComponent extends DestroyableComponent {
        public events: string[] = [];

        constructor() {
          super();

          this.subscriptions.subscribe('event1', async () => {
            this.events.push('event1');
          });

          this.subscriptions.subscribe('event2', async () => {
            this.events.push('event2');
          });

          this.subscriptions.subscribe('event3', async () => {
            this.events.push('event3');
          });
        }
      }

      const component = new MultiEventComponent();

      await eventBus.publish('event1', {});
      await eventBus.publish('event2', {});
      await eventBus.publish('event3', {});

      expect(component.events).toEqual(['event1', 'event2', 'event3']);

      await component.destroy();

      // No events after destroy
      await eventBus.publish('event1', {});
      await eventBus.publish('event2', {});

      expect(component.events).toEqual(['event1', 'event2', 'event3']);
    });
  });

  describe('Destroyable interface', () => {
    it('should enforce destroy() method', () => {
      class TestService implements Destroyable {
        async destroy(): Promise<void> {
          // Cleanup logic
        }
      }

      const service = new TestService();
      expect(service.destroy).toBeDefined();
      expect(typeof service.destroy).toBe('function');
    });

    it('should support sync and async destroy()', async () => {
      class SyncDestroyable implements Destroyable {
        public destroyed = false;

        destroy(): void {
          this.destroyed = true;
        }
      }

      class AsyncDestroyable implements Destroyable {
        public destroyed = false;

        async destroy(): Promise<void> {
          await new Promise(resolve => setTimeout(resolve, 10));
          this.destroyed = true;
        }
      }

      const sync = new SyncDestroyable();
      const async = new AsyncDestroyable();

      sync.destroy();
      expect(sync.destroyed).toBe(true);

      await async.destroy();
      expect(async.destroyed).toBe(true);
    });
  });

  describe('Real-world usage patterns', () => {
    it('should support session manager pattern', async () => {
      class SessionManager implements Destroyable {
        private subscriptions = createSubscriptionManager();
        private sessionId: string;
        public silenceCount = 0;
        public trackChanges = 0;

        constructor(sessionId: string) {
          this.sessionId = sessionId;

          this.subscriptions.subscribe('silence.detected', async (payload) => {
            this.silenceCount++;
          });

          this.subscriptions.subscribe('track.change.detected', async (payload) => {
            this.trackChanges++;
          });
        }

        async destroy(): Promise<void> {
          this.subscriptions.cleanup();
          // Could also save session to database here
        }
      }

      const session1 = new SessionManager('session-1');
      const session2 = new SessionManager('session-2');

      await eventBus.publish('silence.detected', {});
      expect(session1.silenceCount).toBe(1);
      expect(session2.silenceCount).toBe(1);

      // End session1
      await session1.destroy();

      await eventBus.publish('silence.detected', {});
      expect(session1.silenceCount).toBe(1); // No change
      expect(session2.silenceCount).toBe(2);

      await eventBus.publish('track.change.detected', {});
      expect(session1.trackChanges).toBe(0); // Never increments
      expect(session2.trackChanges).toBe(1);

      await session2.destroy();
    });

    it('should handle concurrent components safely', async () => {
      class Worker implements Destroyable {
        private subscriptions = createSubscriptionManager();
        public workCount = 0;

        constructor() {
          this.subscriptions.subscribe('work.available', async () => {
            this.workCount++;
          });
        }

        async destroy(): Promise<void> {
          this.subscriptions.cleanup();
        }
      }

      // Create 10 workers
      const workers = Array.from({ length: 10 }, () => new Worker());

      // Broadcast work
      await eventBus.publish('work.available', {});

      // All workers should have received it
      workers.forEach(worker => {
        expect(worker.workCount).toBe(1);
      });

      // Destroy first 5 workers
      await Promise.all(workers.slice(0, 5).map(w => w.destroy()));

      // Broadcast again
      await eventBus.publish('work.available', {});

      // First 5 should still have 1, last 5 should have 2
      workers.slice(0, 5).forEach(worker => {
        expect(worker.workCount).toBe(1);
      });
      workers.slice(5).forEach(worker => {
        expect(worker.workCount).toBe(2);
      });

      // Cleanup remaining
      await Promise.all(workers.slice(5).map(w => w.destroy()));
    });
  });
});

