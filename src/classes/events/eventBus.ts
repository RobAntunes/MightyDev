import { v4 } from "uuid";
import { CustomEventEmitter } from "./eventEmitter";
import {
  EventBusAdapter,
  EventBusMetrics,
  EventCallback,
  EventFilter,
  EventMetrics,
  EventPriority,
  EventStats,
  PublishOptions,
  RetryConfig,
  SubscribeOptions,
} from "@/types/events";

///////////////////////////////////////////////////////////////////////////////
// EVENT STATS MANAGER
///////////////////////////////////////////////////////////////////////////////

export class EventStatsManager {
  private stats: EventStats;
  private readonly maxHistoryLength: number = 100;
  private readonly maxRecentErrors: number = 50;
  private readonly statsUpdateInterval: number = 1000;

  constructor() {
    this.stats = this.initializeStats();
    this.startPeriodicUpdate();
  }

  private initializeStats(): EventStats {
    return {
      eventCounts: new Map(),
      timing: {
        averageProcessingTime: 0,
        maxProcessingTime: 0,
        minProcessingTime: Infinity,
      },
      subscriptions: {
        totalActive: 0,
        byTopic: new Map(),
        topSubscribedTopics: [],
      },
      errors: {
        totalErrors: 0,
        byType: new Map(),
        recentErrors: [],
      },
      performance: {
        messageRate: 0,
        throughput: 0,
        backpressure: 0,
      },
      context: {
        activeContexts: 0,
        averageContextSize: 0,
        topContexts: [],
      },
      history: {
        lastUpdated: Date.now(),
        timeWindow: 3600000,
        snapshots: [],
      },
    };
  }

  public recordEvent(
    topic: string,
    size: number,
    processingTime: number,
    success: boolean,
  ): void {
    const counts = this.stats.eventCounts.get(topic) ||
      { published: 0, delivered: 0, failed: 0 };
    counts.published++;

    if (success) {
      counts.delivered++;
    } else {
      counts.failed++;
    }
    this.stats.eventCounts.set(topic, counts);

    this.updateTimingStats(processingTime);
    this.updatePerformanceMetrics(size);
  }

  private updateTimingStats(processingTime: number): void {
    const { timing } = this.stats;
    if (processingTime > timing.maxProcessingTime) {
      timing.maxProcessingTime = processingTime;
    }
    if (processingTime < timing.minProcessingTime) {
      timing.minProcessingTime = processingTime;
    }

    // exponential moving average
    const alpha = 0.1;
    timing.averageProcessingTime = alpha * processingTime +
      (1 - alpha) * timing.averageProcessingTime;
  }

  private updatePerformanceMetrics(messageSize: number): void {
    const now = Date.now();
    const timeDiff = (now - this.stats.history.lastUpdated) / 1000;

    if (timeDiff > 0) {
      this.stats.performance.messageRate = 1 / timeDiff;
      this.stats.performance.throughput = messageSize / timeDiff;
    }
  }

  private startPeriodicUpdate(): void {
    setInterval(() => {
      this.takeSnapshot();
      this.pruneHistory();
    }, this.statsUpdateInterval);
  }

  private takeSnapshot(): void {
    const snapshot = {
      timestamp: Date.now(),
      eventCount: Array.from(this.stats.eventCounts.values()).reduce(
        (sum, counts) => sum + counts.published,
        0,
      ),
      activeSubscriptions: this.stats.subscriptions.totalActive,
      errorCount: this.stats.errors.totalErrors,
    };
    this.stats.history.snapshots.push(snapshot);
    this.stats.history.lastUpdated = snapshot.timestamp;
  }

  private pruneHistory(): void {
    const now = Date.now();
    const { timeWindow } = this.stats.history;

    this.stats.history.snapshots = this.stats.history.snapshots
      .filter((snapshot) => now - snapshot.timestamp < timeWindow)
      .slice(-this.maxHistoryLength);

    this.stats.errors.recentErrors = this.stats.errors.recentErrors
      .filter((err) => now - err.timestamp < timeWindow)
      .slice(-this.maxRecentErrors);
  }

  public getStats(): EventStats {
    // Return a structural clone to avoid external mutations
    return structuredClone(this.stats);
  }
}

///////////////////////////////////////////////////////////////////////////////
// LOCAL EVENT BUS
///////////////////////////////////////////////////////////////////////////////

export class LocalEventBus extends CustomEventEmitter
  implements EventBusAdapter {
  private subscriptions: Map<
    string,
    {
      id: string;
      topic: string;
      callback: EventCallback;
      filter?: (data: unknown) => boolean;
      contextId?: string;
    }
  > = new Map();

  private metricsHistory: EventMetrics[] = [];

  constructor(private retryConfig?: Partial<RetryConfig>) {
    super();
  }

  get metrics(): EventBusMetrics {
    const successfulEvents =
      this.metricsHistory.filter((m) => m.success).length;
    const failedEvents = this.metricsHistory.filter((m) => !m.success).length;
    return {
      totalEvents: this.metricsHistory.length,
      successfulEvents,
      failedEvents,
      averageLatency: this.calculateAverageLatency(),
      retryRate: this.calculateRetryRate(),
    };
  }

  get stats(): EventStats {
    return this.getStatsManager().getStats();
  }

  private calculateAverageLatency(): number {
    if (this.metricsHistory.length === 0) return 0;
    const sum = this.metricsHistory.reduce(
      (acc, m) => acc + m.processingTime,
      0,
    );
    return sum / this.metricsHistory.length;
  }

  private calculateRetryRate(): number {
    // For local bus, let's treat "retry attempts" as # of failed events
    const retryAttempts = this.metricsHistory.filter((m) => !m.success).length;
    return this.metricsHistory.length > 0
      ? retryAttempts / this.metricsHistory.length
      : 0;
  }

  public async publish<T>(
    topic: string,
    data: T,
    source: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      // collect all subscriptions for this topic
      const matchingSubscriptions = Array.from(this.subscriptions.values())
        .filter(
          (sub) => sub.topic === topic,
        );

      // call each subscriber
      for (const sub of matchingSubscriptions) {
        if (!sub.filter || sub.filter(data)) {
          await Promise.resolve(sub.callback(data));
        }
      }
      success = true;
    } catch (err) {
      error = err instanceof Error ? err.message : `${err}`;
      throw err;
    } finally {
      const metric: EventMetrics = {
        type: topic,
        processingTime: Date.now() - startTime,
        size: JSON.stringify(data).length,
        timestamp: Date.now(),
        success,
        error,
      };
      this.metricsHistory.push(metric);
      // Let internal emitter handle "eventProcessed" or any custom events
      this.emit("eventProcessed", metric);

      // Record stats
      this.getStatsManager().recordEvent(
        topic,
        metric.size,
        metric.processingTime,
        success,
      );
    }
  }

  /**
   * Subscribes a callback to a topic. Returns a Promise resolving to subscriptionId
   */
  public async subscribe(
    topic: string,
    callback: EventCallback,
    options: SubscribeOptions = {},
  ): Promise<string> {
    const subscriptionId = crypto.randomUUID();
    this.subscriptions.set(subscriptionId, {
      id: subscriptionId,
      topic,
      callback,
      filter: options.filter as ((data: any) => boolean),
      contextId: options.contextId,
    });
    // Increase total active subscription count in stats
    const mgr = this.getStatsManager();
    mgr.getStats().subscriptions.totalActive++;
    // Or do more refined stats updates if you prefer
    const byTopicMap = mgr.getStats().subscriptions.byTopic;
    byTopicMap.set(topic, (byTopicMap.get(topic) || 0) + 1);

    return subscriptionId;
  }

  /**
   * Unsubscribe by subscription ID
   */
  public async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return; // no-op if not found

    this.subscriptions.delete(subscriptionId);

    // Decrement stats
    const mgr = this.getStatsManager();
    const stats = mgr.getStats();
    stats.subscriptions.totalActive = Math.max(
      stats.subscriptions.totalActive - 1,
      0,
    );

    const count = stats.subscriptions.byTopic.get(sub.topic) || 0;
    stats.subscriptions.byTopic.set(sub.topic, Math.max(count - 1, 0));
  }
}

///////////////////////////////////////////////////////////////////////////////
// AWS EVENT BUS
///////////////////////////////////////////////////////////////////////////////

export interface AWSEventBusConfig {
  region: string;
  eventBusName: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  maxRetries?: number;
  retryDelay?: number;
}

interface AWSEvent<T> {
  id: string;
  topic: string;
  source: string;
  data: T;
  timestamp: number;
}

interface AWSEventMetrics extends EventMetrics {
  retryCount?: number;
  batchId?: string;
}

/**
 * Dummy AWS implementation simulating batch publish
 */
export class AWSEventBus extends CustomEventEmitter implements EventBusAdapter {
  private readonly config: AWSEventBusConfig;
  private metricsHistory: AWSEventMetrics[] = [];
  private pendingEvents: Map<string, AWSEvent<unknown>> = new Map();
  private batchProcessor?: NodeJS.Timeout;
  private subscriptions: Map<string, boolean> = new Map(); // AWS typically doesn't do local subs
  public stats: EventStats;

  constructor(config: AWSEventBusConfig) {
    super();
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      ...config,
    };
    this.stats = this.getStatsManager().getStats();
    this.setupBatchProcessor();
  }

  get metrics(): EventBusMetrics {
    const successfulEvents =
      this.metricsHistory.filter((m) => m.success).length;
    const failedEvents = this.metricsHistory.filter((m) => !m.success).length;
    return {
      totalEvents: this.metricsHistory.length,
      successfulEvents,
      failedEvents,
      averageLatency: this.calculateAverageLatency(),
      retryRate: this.calculateRetryRate(),
    };
  }

  private calculateAverageLatency(): number {
    if (this.metricsHistory.length === 0) return 0;
    const sum = this.metricsHistory.reduce(
      (acc, m) => acc + m.processingTime,
      0,
    );
    return sum / this.metricsHistory.length;
  }

  private calculateRetryRate(): number {
    const retryAttempts = this.metricsHistory.reduce(
      (acc, m) => acc + (m.retryCount || 0),
      0,
    );
    return this.metricsHistory.length > 0
      ? retryAttempts / this.metricsHistory.length
      : 0;
  }

  private setupBatchProcessor(): void {
    const BATCH_INTERVAL = 100; // 100ms batch window
    this.batchProcessor = setInterval(() => {
      this.processPendingEvents().catch((error) => {
        console.error("Failed to process event batch:", error);
      });
    }, BATCH_INTERVAL);
  }

  private async processPendingEvents(): Promise<void> {
    if (this.pendingEvents.size === 0) return;

    const batchId = v4();
    const events = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();

    try {
      // Simulate random fail
      await this.publishToBatch(events, batchId);
      for (const event of events) {
        const metric: AWSEventMetrics = {
          type: event.topic,
          processingTime: Date.now() - event.timestamp,
          size: JSON.stringify(event.data).length,
          timestamp: Date.now(),
          success: true,
          batchId,
        };
        this.metricsHistory.push(metric);
        this.emit("eventProcessed", metric);

        this.getStatsManager().recordEvent(
          event.topic,
          metric.size,
          metric.processingTime,
          true,
        );
      }
    } catch (error) {
      // handle failures => possibly schedule retries
      for (const event of events) {
        const metric: AWSEventMetrics = {
          type: event.topic,
          processingTime: Date.now() - event.timestamp,
          size: JSON.stringify(event.data).length,
          timestamp: Date.now(),
          success: false,
          error: error instanceof Error ? error.message : `${error}`,
        };
        this.metricsHistory.push(metric);
        this.emit("eventProcessed", metric);
        this.emit("eventFailed", { event, error });

        this.getStatsManager().recordEvent(
          event.topic,
          metric.size,
          metric.processingTime,
          false,
        );
      }
    }
  }

  private async publishToBatch(
    events: AWSEvent<unknown>[],
    batchId: string,
  ): Promise<void> {
    // Simulate AWS EventBridge batch publish with random failures
    await new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() < 0.1) {
          reject(new Error("Simulated AWS EventBridge failure"));
        } else {
          resolve();
        }
      }, 50);
    });
  }

  public async publish<T>(
    topic: string,
    data: T,
    source: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const event: AWSEvent<T> = {
      id: v4(),
      topic,
      source,
      data,
      timestamp: Date.now(),
    };
    // queue event for batch
    this.pendingEvents.set(event.id, event);
  }

  /**
   * AWS EventBridge doesn’t have a direct concept of local “subscribe”.
   * Typically subscriptions are infra-coded. We’ll stub these out.
   */
  public async subscribe(
    topic: string,
    callback: EventCallback,
    options?: SubscribeOptions,
  ): Promise<string> {
    // not really supported: simulate a local store
    const id = v4();
    this.subscriptions.set(id, true);
    console.warn("AWS subscriptions should typically be configured externally");
    return id;
  }

  public async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }

  public cleanup(): void {
    if (this.batchProcessor) {
      clearInterval(this.batchProcessor);
    }
    this.pendingEvents.clear();
  }
}

///////////////////////////////////////////////////////////////////////////////
// HYBRID EVENT BUS
///////////////////////////////////////////////////////////////////////////////

export interface HybridEventBusConfig {
  local: {
    maxConcurrentEvents?: number;
    eventTTL?: number;
    retry?: RetryConfig;
    bufferSize?: number;
    drainInterval?: number;
  };
  aws: AWSEventBusConfig;
  awsTopics: string[];
  mode: "hybrid" | "local-only" | "aws-only";
}

export class HybridEventBus extends CustomEventEmitter
  implements EventBusAdapter {
  private localBus: LocalEventBus;
  private awsBus: AWSEventBus;
  private readonly config: HybridEventBusConfig;

  constructor(config: HybridEventBusConfig) {
    super();
    this.config = config;
    this.localBus = new LocalEventBus(config.local.retry);
    this.awsBus = new AWSEventBus(config.aws);
  }

  get metrics(): EventBusMetrics {
    const localMetrics = this.localBus.metrics;
    const awsMetrics = this.awsBus.metrics;
    const totalEvents = localMetrics.totalEvents + awsMetrics.totalEvents;
    const successfulEvents = localMetrics.successfulEvents +
      awsMetrics.successfulEvents;
    const failedEvents = localMetrics.failedEvents + awsMetrics.failedEvents;

    const averageLatency = totalEvents > 0
      ? (localMetrics.averageLatency * localMetrics.totalEvents +
        awsMetrics.averageLatency * awsMetrics.totalEvents) /
        totalEvents
      : 0;

    const retryRate = totalEvents > 0
      ? (localMetrics.retryRate * localMetrics.totalEvents +
        awsMetrics.retryRate * awsMetrics.totalEvents) /
        totalEvents
      : 0;

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      averageLatency,
      retryRate,
    };
  }

  get stats(): EventStats {
    const localStats = this.localBus.stats;
    const awsStats = this.awsBus.stats;
    // We'll do a naive merge (just example).
    // For a real system, you'd carefully combine these.
    // E.g., combine eventCounts, errors, subscriptions, etc.

    // Combine eventCounts
    const mergedEventCounts = new Map<
      string,
      { published: number; delivered: number; failed: number }
    >();
    for (const [topic, counts] of localStats.eventCounts.entries()) {
      mergedEventCounts.set(topic, { ...counts });
    }
    for (const [topic, counts] of awsStats.eventCounts.entries()) {
      const existing = mergedEventCounts.get(topic) ||
        { published: 0, delivered: 0, failed: 0 };
      mergedEventCounts.set(topic, {
        published: existing.published + counts.published,
        delivered: existing.delivered + counts.delivered,
        failed: existing.failed + counts.failed,
      });
    }

    // Merge the rest in a simplistic manner
    return {
      eventCounts: mergedEventCounts,
      timing: {
        averageProcessingTime:
          (localStats.timing.averageProcessingTime +
            awsStats.timing.averageProcessingTime) / 2,
        maxProcessingTime: Math.max(
          localStats.timing.maxProcessingTime,
          awsStats.timing.maxProcessingTime,
        ),
        minProcessingTime: Math.min(
          localStats.timing.minProcessingTime,
          awsStats.timing.minProcessingTime,
        ),
      },
      subscriptions: {
        totalActive: localStats.subscriptions.totalActive +
          awsStats.subscriptions.totalActive,
        byTopic: new Map([
          ...localStats.subscriptions.byTopic,
          ...awsStats.subscriptions.byTopic,
        ]),
        topSubscribedTopics: [
          ...localStats.subscriptions.topSubscribedTopics,
          ...awsStats.subscriptions.topSubscribedTopics,
        ],
      },
      errors: {
        totalErrors: localStats.errors.totalErrors +
          awsStats.errors.totalErrors,
        byType: new Map([
          ...localStats.errors.byType,
          ...awsStats.errors.byType,
        ]),
        recentErrors: [
          ...localStats.errors.recentErrors,
          ...awsStats.errors.recentErrors,
        ],
      },
      performance: {
        messageRate: localStats.performance.messageRate +
          awsStats.performance.messageRate,
        throughput: localStats.performance.throughput +
          awsStats.performance.throughput,
        backpressure: Math.max(
          localStats.performance.backpressure,
          awsStats.performance.backpressure,
        ),
      },
      context: {
        activeContexts: localStats.context.activeContexts +
          awsStats.context.activeContexts,
        averageContextSize:
          (localStats.context.averageContextSize +
            awsStats.context.averageContextSize) / 2,
        topContexts: [
          ...localStats.context.topContexts,
          ...awsStats.context.topContexts,
        ],
      },
      history: {
        lastUpdated: Math.max(
          localStats.history.lastUpdated,
          awsStats.history.lastUpdated,
        ),
        timeWindow: Math.max(
          localStats.history.timeWindow,
          awsStats.history.timeWindow,
        ),
        snapshots: [
          ...localStats.history.snapshots,
          ...awsStats.history.snapshots,
        ].sort(
          (a, b) => b.timestamp - a.timestamp,
        ),
      },
    };
  }

  private shouldRouteToAWS(topic: string): boolean {
    if (this.config.mode === "aws-only") return true;
    if (this.config.mode === "local-only") return false;
    // default "hybrid" => check config.awsTopics
    return this.config.awsTopics.includes(topic);
  }

  public async publish<T>(
    topic: string,
    data: T,
    source: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;

    try {
      if (this.shouldRouteToAWS(topic)) {
        await this.awsBus.publish(topic, data, source, options);
      } else {
        await this.localBus.publish(topic, data, source, options);
      }
      success = true;
    } catch (error) {
      this.getStatsManager().recordEvent(
        topic,
        JSON.stringify(data).length,
        Date.now() - startTime,
        false,
      );
      throw error;
    }

    this.getStatsManager().recordEvent(
      topic,
      JSON.stringify(data).length,
      Date.now() - startTime,
      success,
    );
  }

  public async subscribe(
    topic: string,
    callback: EventCallback,
    options?: SubscribeOptions,
  ): Promise<string> {
    if (this.shouldRouteToAWS(topic)) {
      return this.awsBus.subscribe(topic, callback, options);
    } else {
      return this.localBus.subscribe(topic, callback, options);
    }
  }

  public async unsubscribe(subscriptionId: string): Promise<void> {
    // We don't actually know if sub was local or AWS.
    // If you store a map, you can track them. For a simple approach,
    // try both (the no-op version won't throw if ID doesn't exist).
    await this.awsBus.unsubscribe(subscriptionId);
    await this.localBus.unsubscribe(subscriptionId);
  }
}
