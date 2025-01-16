import {
  EventBusMetrics,
  EventCallback,
  EventMap,
  PublishOptions,
  SubscribeOptions,
} from "@/types/events";

export class CustomEventEmitter {
  private readonly listeners: Map<string, Array<(...args: any[]) => void>> =
    new Map();
  private maxListeners: number = 10;

  setMaxListeners(n: number): this {
    this.maxListeners = n;
    return this;
  }

  getMaxListeners(): number {
    return this.maxListeners;
  }

  on<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void,
  ): this {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, []);
    }
    this.listeners.get(event as string)!.push(listener);
    return this;
  }

  once<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void,
  ): this {
    const onceWrapper = (...args: EventMap[K]) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.on(event, onceWrapper);
  }

  off<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void,
  ): this {
    if (!this.listeners.has(event as string)) return this;

    const eventListeners = this.listeners.get(event as string)!;
    const index = eventListeners.indexOf(listener);

    if (index !== -1) {
      eventListeners.splice(index, 1);
      if (eventListeners.length === 0) {
        this.listeners.delete(event as string);
      }
    }
    return this;
  }

  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
    if (!this.listeners.has(event as string)) return false;

    const eventListeners = this.listeners.get(event as string)!;
    eventListeners.forEach((listener) => {
      try {
        listener.apply(this, args);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    });

    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  listenerCount(event: string): number {
    return this.listeners.get(event)?.length || 0;
  }

  rawListeners(event: string): Function[] {
    return [...(this.listeners.get(event) || [])];
  }

  eventNames(): Array<string> {
    return Array.from(this.listeners.keys());
  }

  prependListener<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void,
  ): this {
    if (!this.listeners.has(event as string)) {
      this.listeners.set(event as string, []);
    }
    this.listeners.get(event as string)!.unshift(listener);
    return this;
  }

  prependOnceListener<K extends keyof EventMap>(
    event: K,
    listener: (...args: EventMap[K]) => void,
  ): this {
    const onceWrapper = (...args: EventMap[K]) => {
      this.off(event, onceWrapper);
      listener.apply(this, args);
    };
    return this.prependListener(event, onceWrapper);
  }
}

// EventBusAdapter interface with proper typing
export interface EventBusAdapter {
  readonly metrics: EventBusMetrics;

  on(event: string | symbol, listener: (...args: any[]) => void): this;
  once(event: string | symbol, listener: (...args: any[]) => void): this;
  off(event: string | symbol, listener: (...args: any[]) => void): this;
  emit(event: string | symbol, ...args: any[]): boolean;
  removeAllListeners(event?: string | symbol): this;
  listenerCount(event: string | symbol): number;
  rawListeners(event: string | symbol): Function[];
  eventNames(): Array<string | symbol>;
  prependListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;
  prependOnceListener(
    event: string | symbol,
    listener: (...args: any[]) => void,
  ): this;

  publish<T>(
    topic: string,
    data: T,
    source: string,
    options?: PublishOptions,
  ): Promise<void>;

  subscribe(
    topic: string,
    callback: EventCallback,
    options?: SubscribeOptions,
  ): Promise<string>;

  unsubscribe(subscriptionId: string): Promise<void>;
}

// Error types
export class EventBusError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown,
  ) {
    super(message);
    this.name = "EventBusError";
  }
}

export class PublishError extends EventBusError {
  constructor(message: string, originalError?: unknown) {
    super(message, "PUBLISH_ERROR", originalError);
    this.name = "PublishError";
  }
}

export class SubscriptionError extends EventBusError {
  constructor(message: string, originalError?: unknown) {
    super(message, "SUBSCRIPTION_ERROR", originalError);
    this.name = "SubscriptionError";
  }
}
