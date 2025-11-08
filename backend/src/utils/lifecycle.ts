import { eventBus, EventHandler } from './event-bus';

/**
 * Destroyable interface for components that need cleanup
 *
 * Implement this interface for any component that:
 * - Subscribes to EventBus events
 * - Manages resources (files, connections, timers, etc.)
 * - Needs cleanup when no longer in use
 */
export interface Destroyable {
  /**
   * Cleanup method called when component is no longer needed
   * Should release all resources and unsubscribe from all events
   */
  destroy(): Promise<void> | void;
}

/**
 * Subscription manager for automatic EventBus cleanup
 *
 * Provides automatic tracking and cleanup of EventBus subscriptions
 * to prevent memory leaks from forgotten unsubscribe calls.
 */
export interface SubscriptionManager {
  /**
   * Subscribe to an event (tracked for cleanup)
   * @param event Event name
   * @param handler Handler function
   */
  subscribe(event: string, handler: EventHandler): void;

  /**
   * Unsubscribe all tracked handlers and clear internal state
   * Call this in your component's destroy() method
   */
  cleanup(): void;

  /**
   * Get number of active subscriptions (useful for debugging)
   */
  getSubscriptionCount(): number;
}

/**
 * Create a new subscription manager for automatic EventBus cleanup
 *
 * This utility helps prevent memory leaks by automatically tracking all
 * EventBus subscriptions and providing a single cleanup() method to
 * unsubscribe from all of them.
 *
 * Usage:
 * ```typescript
 * class MyService implements Destroyable {
 *   private subscriptions = createSubscriptionManager();
 *
 *   constructor() {
 *     // Subscribe using the manager (automatically tracked)
 *     this.subscriptions.subscribe('audio.start', async (payload) => {
 *       console.log('Audio started:', payload);
 *     });
 *
 *     this.subscriptions.subscribe('audio.stop', async (payload) => {
 *       console.log('Audio stopped:', payload);
 *     });
 *   }
 *
 *   async destroy() {
 *     // Single call cleans up ALL subscriptions
 *     this.subscriptions.cleanup();
 *   }
 * }
 * ```
 *
 * @returns A new SubscriptionManager instance
 */
export function createSubscriptionManager(): SubscriptionManager {
  // Map stores event name -> handler for cleanup
  const handlers = new Map<string, EventHandler>();

  return {
    subscribe(event: string, handler: EventHandler): void {
      // Generate unique key for this subscription
      // This allows multiple subscriptions to the same event
      const key = `${event}:${Date.now()}:${Math.random()}`;
      
      handlers.set(key, handler);
      eventBus.subscribe(event, handler);
    },

    cleanup(): void {
      // Unsubscribe all handlers
      handlers.forEach((handler, key) => {
        const event = key.split(':')[0]; // Extract event name from key
        eventBus.unsubscribe(event, handler);
      });

      // Clear internal state
      handlers.clear();
    },

    getSubscriptionCount(): number {
      return handlers.size;
    }
  };
}

/**
 * Alternative pattern: Base class with automatic cleanup
 *
 * For components that prefer inheritance over composition.
 *
 * Usage:
 * ```typescript
 * class MyService extends DestroyableComponent {
 *   constructor() {
 *     super();
 *
 *     // Use this.subscriptions from parent class
 *     this.subscriptions.subscribe('audio.start', async (payload) => {
 *       console.log('Audio started:', payload);
 *     });
 *   }
 *
 *   async destroy() {
 *     // Call parent destroy to cleanup subscriptions
 *     await super.destroy();
 *
 *     // Add your own cleanup here
 *     // ...
 *   }
 * }
 * ```
 */
export abstract class DestroyableComponent implements Destroyable {
  protected subscriptions: SubscriptionManager;

  constructor() {
    this.subscriptions = createSubscriptionManager();
  }

  /**
   * Cleanup all EventBus subscriptions
   * Override this method to add your own cleanup logic,
   * but remember to call super.destroy()
   */
  async destroy(): Promise<void> {
    this.subscriptions.cleanup();
  }
}

