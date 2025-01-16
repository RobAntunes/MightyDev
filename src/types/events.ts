export type EventPriority = 'low' | 'medium' | 'high' | 'critical';

export interface EventBusAdapter {
  readonly metrics: EventBusMetrics;

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

  publish<T>(topic: string, data: T, source: string, options?: PublishOptions): Promise<void>;
  subscribe(topic: string, callback: EventCallback, options?: SubscribeOptions): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
}

export interface EventBusConfig {
  mode: "local" | "aws" | "hybrid";
  region?: string;
  eventBusName?: string;
  awsTopics?: string[];
  retryConfig?: Partial<RetryConfig>;
}


export interface EventMetadata {
  timestamp: number;
  source: string;
  priority: EventPriority;
  contextId?: string;
  sessionId?: string;
  userId?: string;
}

export interface EventPayload<T = unknown> {
  type: string;
  data: T;
  metadata: EventMetadata;
}

export interface EventMetrics {
  timestamp: number;
  type: string;
  success: boolean;
  latency: number;
  retryCount: number;
}

export interface EventBusMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  averageLatency: number;
  retryRate: number;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMultiplier: number;
  initialDelay: number;
  maxDelay: number;
}

export interface PublishOptions {
  priority?: EventPriority;
  contextId?: string;
  sessionId?: string;
  userId?: string;
}

export interface SubscribeOptions {
  priority?: EventPriority;
  filter?: EventFilter;
}

export type EventCallback = (event: EventPayload) => Promise<void> | void;
export type EventFilter = (event: EventPayload) => boolean;

// Define event map for strict typing of events
export interface EventMap {
  'eventProcessed': [EventMetrics];
  'error': [Error];
  [key: string]: any[];
}