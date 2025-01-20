// Basic event bus types

export type EventPriority = "low" | "medium" | "high" | "critical";

export interface PublishOptions {
  priority?: EventPriority;
  contextId?: string;
  sessionId?: string;
  userId?: string;
  retain?: boolean;
  qos?: 0 | 1 | 2;
  retry?: Partial<RetryConfig>;
  timeout?: number;
}

export interface SubscribeOptions {
  priority?: EventPriority;
  filter?: EventFilter;
  qos?: 0 | 1 | 2;
  contextId?: string;
}

export type EventCallback = (...args: any[]) => void | Promise<void>;
export type EventFilter = (event: EventPayload) => boolean;

/**
 * Basic shape of a published event
 */
export interface EventPayload<T = unknown> {
  type: string;
  data: T;
  metadata: EventMetadata;
}

export interface EventMetadata {
  timestamp: number;
  source: string;
  priority: EventPriority;
  contextId?: string;
  sessionId?: string;
  userId?: string;
}

/**
 * Retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay?: number;
}

/**
 * Metrics for a single event
 */
export interface EventMetrics {
  type: string;
  processingTime: number;
  size: number;
  timestamp: number;
  success: boolean;
  retryCount?: number;
  error?: string;
}

/**
 * Aggregate metrics for the entire bus
 */
export interface EventBusMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  averageLatency: number;
  retryRate: number;

  // Optional expansions
  currentBatchSize?: number;
  publishedEvents?: number;
  subscribedEvents?: number;
  activeSubscriptions?: number;
  lastEventTimestamp?: number;
}

/**
 * Detailed stats about events, errors, timing, etc.
 */
export interface EventStats {
  eventCounts: Map<string, {
    published: number;
    delivered: number;
    failed: number;
  }>;
  timing: {
    averageProcessingTime: number;
    maxProcessingTime: number;
    minProcessingTime: number;
  };
  subscriptions: {
    totalActive: number;
    byTopic: Map<string, number>;
    topSubscribedTopics: Array<{
      topic: string;
      count: number;
    }>;
  };
  errors: {
    totalErrors: number;
    byType: Map<string, number>;
    recentErrors: Array<{
      timestamp: number;
      type: string;
      message: string;
    }>;
  };
  performance: {
    messageRate: number;
    throughput: number;
    backpressure: number;
  };
  context: {
    activeContexts: number;
    averageContextSize: number;
    topContexts: Array<{
      id: string;
      eventCount: number;
      lastActive: number;
    }>;
  };
  history: {
    lastUpdated: number;
    timeWindow: number;
    snapshots: Array<{
      timestamp: number;
      eventCount: number;
      activeSubscriptions: number;
      errorCount: number;
    }>;
  };
}

/**
 * High-level adapter interface for any event bus (Local, AWS, Hybrid, etc.)
 */
export interface EventBusAdapter {
  readonly metrics: EventBusMetrics;
  readonly stats: EventStats;

  // Standard Node.js-like emitter methods
  on(event: string, listener: (...args: any[]) => void): this;
  once(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
  removeAllListeners(event?: string): this;
  listenerCount(event: string): number;
  rawListeners(event: string): Function[];
  eventNames(): Array<string>;
  prependListener(event: string, listener: (...args: any[]) => void): this;
  prependOnceListener(event: string, listener: (...args: any[]) => void): this;

  // Core bus methods
  publish<T>(
    topic: string,
    data: T,
    source: string,
    options?: PublishOptions
  ): Promise<void>;

  subscribe(
    topic: string,
    callback: EventCallback,
    options?: SubscribeOptions
  ): Promise<string>;

  unsubscribe(subscriptionId: string): Promise<void>;
}