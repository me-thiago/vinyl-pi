import { createLogger } from './logger';

const logger = createLogger('EventBus');

/**
 * Event types supported in V1, V2, and V3a
 */
export type EventType =
  // V1 - Audio events
  | 'audio.start'
  | 'audio.stop'
  | 'audio.level'
  | 'silence.detected'
  | 'silence.ended'
  | 'turntable.idle'
  | 'turntable.active'
  | 'track.change.detected'
  | 'session.started'
  | 'session.ended'
  | 'clipping.detected'
  // V2 - Recognition events
  | 'track.recognized'
  // V3a - Recording events
  | 'recording.started'
  | 'recording.stopped'
  | 'recording.deleted'
  | 'recording.trimmed'
  | 'storage.alert'
  | 'storage.ok';

/**
 * Event handler function signature
 * Must be async and accept plain object payload
 */
export type EventHandler = (payload: Record<string, any>) => Promise<void>;

/**
 * EventBus - Simple pub/sub pattern for internal event communication
 *
 * Features:
 * - Multiple subscribers per event
 * - Serializable payloads (plain objects)
 * - Async handlers with exception handling
 * - No external dependencies
 *
 * ⚠️ CRITICAL MEMORY LEAK WARNING:
 *
 * Handlers create CLOSURES that retain references to the component context.
 * If you forget to unsubscribe, the entire component (including all data)
 * stays in memory FOREVER, even after you "delete" it.
 *
 * ✅ CORRECT USAGE PATTERN:
 *
 * ```typescript
 * class MyService {
 *   private handler: EventHandler;
 *
 *   constructor() {
 *     // Store handler reference for cleanup
 *     this.handler = async (payload) => {
 *       this.processEvent(payload);
 *     };
 *
 *     eventBus.subscribe('event.name', this.handler);
 *   }
 *
 *   // MANDATORY: Always implement cleanup
 *   async destroy() {
 *     eventBus.unsubscribe('event.name', this.handler);
 *     // ... other cleanup
 *   }
 * }
 * ```
 *
 * ❌ WRONG USAGE (Memory Leak):
 *
 * ```typescript
 * class MyService {
 *   constructor() {
 *     // Anonymous function - can't unsubscribe later!
 *     eventBus.subscribe('event.name', async (payload) => {
 *       this.processEvent(payload);
 *     });
 *   }
 *
 *   // ❌ No destroy method = memory leak!
 * }
 * ```
 *
 * 📋 CHECKLIST for Every Component Using EventBus:
 * - [ ] Store handler as class property (not anonymous)
 * - [ ] Implement destroy() method
 * - [ ] Call unsubscribe() in destroy()
 * - [ ] Call destroy() when component is no longer needed
 *
 * NOTE: For long-lived services (e.g., audio-manager), it's OK to NOT unsubscribe
 * since they live for the entire app lifetime.
 *
 * For easier cleanup management, see utils/lifecycle.ts for SubscriptionManager utility.
 *
 * Usage:
 * ```typescript
 * // Subscribe
 * eventBus.subscribe('audio.start', async (payload) => {
 *   console.log('Audio started:', payload.timestamp);
 * });
 *
 * // Publish
 * eventBus.publish('audio.start', { timestamp: new Date().toISOString() });
 * ```
 */
export class EventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  private maxListenersPerEvent = 50;

  /**
   * Subscribe to an event
   * @param event Event name (e.g., 'audio.start')
   * @param handler Async handler function
   */
  subscribe(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    const handlers = this.listeners.get(event)!;

    // 🛡️ GUARD: Detect duplicate subscriptions
    if (handlers.has(handler)) {
      logger.warn(`EventBus: Handler already registered for '${event}' - ignoring duplicate`);
      return;
    }

    // 🛡️ GUARD: Warn about potential memory leaks in development
    if (process.env.NODE_ENV !== 'production' && handlers.size >= 10) {
      logger.warn(
        `EventBus: Event '${event}' has ${handlers.size} listeners. ` +
        `If this number keeps growing, you may have a memory leak. ` +
        `Ensure all components call unsubscribe() in their destroy() method.`
      );
    }

    // 🛡️ GUARD: Hard limit to prevent runaway memory leaks
    if (handlers.size >= this.maxListenersPerEvent) {
      const error = new Error(
        `EventBus: Too many listeners (${handlers.size}) for '${event}'. ` +
        `Maximum allowed: ${this.maxListenersPerEvent}. ` +
        `This indicates a memory leak. Check that components unsubscribe properly.`
      );
      logger.error(error.message);
      throw error;
    }

    handlers.add(handler);
    logger.info(`EventBus: Subscribed to '${event}' (total: ${handlers.size})`);
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param handler Handler function to remove
   */
  unsubscribe(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      logger.warn(`EventBus: Cannot unsubscribe from '${event}' - no listeners registered`);
      return;
    }

    const deleted = handlers.delete(handler);
    if (deleted) {
      logger.info(`EventBus: Unsubscribed from '${event}' (remaining: ${handlers.size})`);

      // Cleanup empty sets
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    } else {
      logger.warn(`EventBus: Handler not found for '${event}'`);
    }
  }

  /**
   * Publish an event to all subscribers
   *
   * CRITICAL: Exceptions in handlers are caught and logged but do NOT propagate.
   * This ensures one failing handler doesn't break others.
   *
   * @param event Event name
   * @param payload Plain object payload (must be JSON serializable)
   */
  async publish(event: string, payload: Record<string, any>): Promise<void> {
    const handlers = this.listeners.get(event);

    if (!handlers || handlers.size === 0) {
      logger.debug(`EventBus: No listeners for '${event}'`);
      return;
    }

    logger.info(`EventBus: Publishing '${event}' to ${handlers.size} listener(s)`);

    // Execute all handlers in parallel
    // Each handler is wrapped in try/catch to prevent exceptions from breaking others
    const promises = Array.from(handlers).map(async (handler) => {
      try {
        await handler(payload);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`EventBus: Handler error for '${event}': ${errorMsg}`);

        // Log stack trace for debugging
        if (error instanceof Error && error.stack) {
          logger.error(`EventBus: Stack trace:\n${error.stack}`);
        }

        // Exception is caught and logged but NOT re-thrown
        // This allows other handlers to continue executing
      }
    });

    // Wait for all handlers to complete
    await Promise.all(promises);
  }

  /**
   * Get count of listeners for an event (useful for debugging/testing)
   * @param event Event name
   * @returns Number of registered listeners
   */
  getListenerCount(event: string): number {
    return this.listeners.get(event)?.size || 0;
  }

  /**
   * Clear all listeners (useful for testing cleanup)
   */
  clearAllListeners(): void {
    this.listeners.clear();
    logger.info('EventBus: All listeners cleared');
  }

  /**
   * Get debug report of all registered listeners
   * Useful for diagnosing memory leaks
   * @returns Formatted string with listener counts per event
   */
  getDebugReport(): string {
    const lines = ['EventBus Memory Report:'];
    
    if (this.listeners.size === 0) {
      lines.push('  No listeners registered');
      return lines.join('\n');
    }

    this.listeners.forEach((handlers, event) => {
      lines.push(`  ${event}: ${handlers.size} listener(s)`);
    });

    const totalListeners = Array.from(this.listeners.values())
      .reduce((sum, handlers) => sum + handlers.size, 0);
    
    lines.push(`  Total: ${totalListeners} listener(s) across ${this.listeners.size} event(s)`);
    
    return lines.join('\n');
  }
}

/**
 * Singleton instance - exported for use across the backend
 */
export const eventBus = new EventBus();
