import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { HybridEventBus, LocalEventBus, AWSEventBus } from './eventBus';
import { EventBusAdapter } from '@/types/events';

interface AWSEventConfig {
  region: string;
  eventBusName: string;
  awsTopics?: string[];
  mode?: 'local' | 'aws' | 'hybrid';
}

class EventSystemManager {
  private static instance: EventSystemManager;
  private eventBus: EventBusAdapter | null = null;
  private config: AWSEventConfig | null = null;

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): EventSystemManager {
    if (!EventSystemManager.instance) {
      EventSystemManager.instance = new EventSystemManager();
    }
    return EventSystemManager.instance;
  }

  public initialize(config: AWSEventConfig): EventBusAdapter {
    if (this.eventBus) {
      return this.eventBus;
    }

    this.config = config;
    const { region, eventBusName, mode = 'hybrid', awsTopics = [] } = config;

    switch (mode) {
      case 'local':
        this.eventBus = new LocalEventBus();
        break;

      case 'aws':
        this.eventBus = new AWSEventBus(region, eventBusName);
        break;

      case 'hybrid':
        this.eventBus = new HybridEventBus(region, eventBusName, awsTopics);
        break;

      default:
        throw new Error(`Unsupported event bus mode: ${mode}`);
    }

    return this.eventBus;
  }

  public getEventBus(): EventBusAdapter {
    if (!this.eventBus) {
      throw new Error(
        'Event system not initialized. Call initialize() first with AWS configuration.'
      );
    }
    return this.eventBus;
  }

  public getConfig(): AWSEventConfig {
    if (!this.config) {
      throw new Error('Event system not initialized.');
    }
    return this.config;
  }

  public reset(): void {
    this.eventBus = null;
    this.config = null;
  }
}

// Export a convenient accessor
export const eventSystem = EventSystemManager.getInstance();

// Export type for configuration
export type { AWSEventConfig };