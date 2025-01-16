import {
  EventBridgeClient,
  PutEventsCommand,
  PutEventsRequestEntry,
} from "@aws-sdk/client-eventbridge";
import { CustomEventEmitter } from "./eventEmitter";
import {
  EventBusAdapter,
  EventBusConfig,
  EventBusMetrics,
  EventCallback,
  EventFilter,
  EventMetrics,
  EventPayload,
  PublishOptions,
  RetryConfig,
  SubscribeOptions,
} from "../../types/events";

export class AWSEventBus extends CustomEventEmitter implements EventBusAdapter {
  private client: EventBridgeClient;
  private eventBusName: string;
  private metricsHistory: EventMetrics[] = [];
  private readonly retryConfig: RetryConfig;
  private subscriptions: Map<string, { ruleArn: string; targetId: string }>;

  constructor(
    region: string,
    eventBusName: string,
    retryConfig: Partial<RetryConfig> = {},
  ) {
    super();
    this.client = new EventBridgeClient({ region });
    this.eventBusName = eventBusName;
    this.subscriptions = new Map();

    this.retryConfig = {
      maxRetries: retryConfig.maxRetries ?? 3,
      backoffMultiplier: retryConfig.backoffMultiplier ?? 2,
      initialDelay: retryConfig.initialDelay ?? 100,
      maxDelay: retryConfig.maxDelay ?? 5000,
    };
  }

  get metrics(): EventBusMetrics {
    const now = Date.now();
    const recentMetrics = this.metricsHistory.filter((m) =>
      now - m.timestamp < 300000
    );

    const total = recentMetrics.length;
    const successful = recentMetrics.filter((m) => m.success).length;
    const failed = total - successful;
    const totalLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0);
    const totalRetries = recentMetrics.reduce(
      (sum, m) => sum + m.retryCount,
      0,
    );

    return {
      totalEvents: total,
      successfulEvents: successful,
      failedEvents: failed,
      averageLatency: total > 0 ? totalLatency / total : 0,
      retryRate: total > 0 ? totalRetries / total : 0,
    };
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.retryConfig.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        this.retryConfig.initialDelay *
          Math.pow(this.retryConfig.backoffMultiplier, retryCount),
        this.retryConfig.maxDelay,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, retryCount + 1);
    }
  }

  async publish<T>(
    topic: string,
    data: T,
    source: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const startTime = Date.now();
    let retryCount = 0;

    const event: PutEventsRequestEntry = {
      EventBusName: this.eventBusName,
      Source: source,
      DetailType: topic,
      Detail: JSON.stringify({
        data,
        metadata: {
          timestamp: startTime,
          priority: options.priority || "medium",
          contextId: options.contextId,
          sessionId: options.sessionId,
          userId: options.userId,
        },
      }),
    };

    try {
      await this.retryWithBackoff(async () => {
        try {
          await this.client.send(
            new PutEventsCommand({
              Entries: [event],
            }),
          );
        } catch (error) {
          retryCount++;
          throw error;
        }
      });

      const metric: EventMetrics = {
        timestamp: startTime,
        type: topic,
        success: true,
        latency: Date.now() - startTime,
        retryCount,
      };

      this.metricsHistory.push(metric);
      this.emit("eventProcessed", metric);
    } catch (error) {
      const metric: EventMetrics = {
        timestamp: startTime,
        type: topic,
        success: false,
        latency: Date.now() - startTime,
        retryCount,
      };

      this.metricsHistory.push(metric);
      this.emit("eventProcessed", metric);
      this.emit(
        "error",
        new Error("Failed to publish event to AWS EventBridge"),
      );

      throw error;
    }

    this.cleanupMetrics();
  }

  async subscribe(
    topic: string,
    callback: EventCallback,
    options: SubscribeOptions = {},
  ): Promise<string> {
    throw new Error(
      "AWS EventBridge subscriptions should be configured via Infrastructure as Code (CloudFormation/CDK)",
    );
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    throw new Error(
      "AWS EventBridge subscriptions should be managed via Infrastructure as Code (CloudFormation/CDK)",
    );
  }

  private cleanupMetrics(): void {
    const now = Date.now();
    this.metricsHistory = this.metricsHistory.filter((m) =>
      now - m.timestamp < 300000
    );
  }
}

export class HybridEventBus extends CustomEventEmitter
  implements EventBusAdapter {
  private localBus: LocalEventBus;
  private awsBus: AWSEventBus;
  private readonly awsTopics: Set<string>;

  constructor(
    region: string,
    eventBusName: string,
    awsTopics: string[] = [],
    retryConfig?: Partial<RetryConfig>,
  ) {
    super();
    this.localBus = new LocalEventBus(retryConfig);
    this.awsBus = new AWSEventBus(region, eventBusName, retryConfig);
    this.awsTopics = new Set(awsTopics);

    // Forward events from both buses
    this.localBus.on(
      "eventProcessed",
      (metric) => this.emit("eventProcessed", metric),
    );
    this.awsBus.on(
      "eventProcessed",
      (metric) => this.emit("eventProcessed", metric),
    );
    this.localBus.on("error", (error) => this.emit("error", error));
    this.awsBus.on("error", (error) => this.emit("error", error));
  }

  get metrics(): EventBusMetrics {
    const localMetrics = this.localBus.metrics;
    const awsMetrics = this.awsBus.metrics;

    return {
      totalEvents: localMetrics.totalEvents + awsMetrics.totalEvents,
      successfulEvents: localMetrics.successfulEvents +
        awsMetrics.successfulEvents,
      failedEvents: localMetrics.failedEvents + awsMetrics.failedEvents,
      averageLatency:
        (localMetrics.averageLatency + awsMetrics.averageLatency) / 2,
      retryRate: (localMetrics.retryRate + awsMetrics.retryRate) / 2,
    };
  }

  async publish<T>(
    topic: string,
    data: T,
    source: string,
    options: PublishOptions = {},
  ): Promise<void> {
    if (this.awsTopics.has(topic)) {
      await this.awsBus.publish(topic, data, source, options);
    }

    await this.localBus.publish(topic, data, source, options);
  }

  async subscribe(
    topic: string,
    callback: EventCallback,
    options: SubscribeOptions = {},
  ): Promise<string> {
    return this.localBus.subscribe(topic, callback, options);
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await this.localBus.unsubscribe(subscriptionId);
  }
}

export class LocalEventBus extends CustomEventEmitter
  implements EventBusAdapter {
  private metricsHistory: EventMetrics[] = [];
  private readonly retryConfig: RetryConfig;
  private readonly subscriptions: Map<
    string,
    Map<string, {
      callback: EventCallback;
      filter?: EventFilter;
    }>
  >;

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    super();
    this.subscriptions = new Map();

    this.retryConfig = {
      maxRetries: retryConfig.maxRetries ?? 3,
      backoffMultiplier: retryConfig.backoffMultiplier ?? 2,
      initialDelay: retryConfig.initialDelay ?? 100,
      maxDelay: retryConfig.maxDelay ?? 5000,
    };
  }

  get metrics(): EventBusMetrics {
    const now = Date.now();
    const recentMetrics = this.metricsHistory.filter((m) =>
      now - m.timestamp < 300000
    );

    const total = recentMetrics.length;
    const successful = recentMetrics.filter((m) => m.success).length;
    const failed = total - successful;
    const totalLatency = recentMetrics.reduce((sum, m) => sum + m.latency, 0);
    const totalRetries = recentMetrics.reduce(
      (sum, m) => sum + m.retryCount,
      0,
    );

    return {
      totalEvents: total,
      successfulEvents: successful,
      failedEvents: failed,
      averageLatency: total > 0 ? totalLatency / total : 0,
      retryRate: total > 0 ? totalRetries / total : 0,
    };
  }

  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retryCount >= this.retryConfig.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        this.retryConfig.initialDelay *
          Math.pow(this.retryConfig.backoffMultiplier, retryCount),
        this.retryConfig.maxDelay,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(operation, retryCount + 1);
    }
  }

  async publish<T>(
    topic: string,
    data: T,
    source: string,
    options: PublishOptions = {},
  ): Promise<void> {
    const event: EventPayload<T> = {
      type: topic,
      data,
      metadata: {
        timestamp: Date.now(),
        source,
        priority: options.priority || "medium",
        contextId: options.contextId || crypto.randomUUID(),
        sessionId: options.sessionId || crypto.randomUUID(),
        userId: options.userId,
      },
    };

    const topicSubscriptions = this.subscriptions.get(topic);
    if (!topicSubscriptions) return;

    const promises = Array.from(topicSubscriptions.values())
      .filter((sub) => !sub.filter || sub.filter(event))
      .map((sub) => sub.callback(event));

    const startTime = Date.now();
    let retryCount = 0;

    try {
      await this.retryWithBackoff(async () => {
        try {
          await Promise.all(promises);
        } catch (error) {
          retryCount++;
          throw error;
        }
      });

      const metric: EventMetrics = {
        timestamp: startTime,
        type: topic,
        success: true,
        latency: Date.now() - startTime,
        retryCount,
      };

      this.metricsHistory.push(metric);
      this.emit("eventProcessed", metric);
    } catch (error) {
      const metric: EventMetrics = {
        timestamp: startTime,
        type: topic,
        success: false,
        latency: Date.now() - startTime,
        retryCount,
      };

      this.metricsHistory.push(metric);
      this.emit("eventProcessed", metric);
      this.emit(
        "error",
        new Error("Failed to publish event after retries"),
      );

      throw error;
    }

    this.cleanupMetrics();
  }

  async subscribe(
    topic: string,
    callback: EventCallback,
    options: SubscribeOptions = {},
  ): Promise<string> {
    const subscriptionId = crypto.randomUUID();

    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Map());
    }

    this.subscriptions.get(topic)!.set(subscriptionId, {
      callback,
      filter: options.filter,
    });

    return subscriptionId;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    for (const [_, subscriptions] of this.subscriptions) {
      subscriptions.delete(subscriptionId);
    }
  }

  private cleanupMetrics(): void {
    const now = Date.now();
    this.metricsHistory = this.metricsHistory.filter((m) =>
      now - m.timestamp < 300000
    );
  }
}

export const createEventBus = (config: EventBusConfig): EventBusAdapter => {
  switch (config.mode) {
    case "local":
      return new LocalEventBus(config.retryConfig);

    case "aws":
      if (!config.region || !config.eventBusName) {
        throw new Error("AWS EventBus requires region and eventBusName");
      }
      return new AWSEventBus(
        config.region,
        config.eventBusName,
        config.retryConfig,
      );

    case "hybrid":
      if (!config.region || !config.eventBusName) {
        throw new Error("Hybrid EventBus requires region and eventBusName");
      }
      return new HybridEventBus(
        config.region,
        config.eventBusName,
        config.awsTopics,
        config.retryConfig,
      );

    default:
      throw new Error(`Unsupported event bus mode: ${config.mode}`);
  }
};
