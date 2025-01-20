import { LocalEventBus } from "./eventBus";
import { AWSEventBus } from "./eventBus";
import { HybridEventBus, HybridEventBusConfig } from "./eventBus";
import { EventBusAdapter, EventBusMetrics, RetryConfig } from "@/types/events";

export interface AWSEventConfig {
    region: string;
    eventBusName: string;
    awsTopics?: string[];
    mode?: "local" | "aws" | "hybrid";
    accessKeyId?: string;
    secretAccessKey?: string;
    maxRetries?: number;
    retryDelay?: number;
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

    /**
     * Initialize the event system
     */
    public initialize(config: AWSEventConfig): EventBusAdapter {
        if (this.eventBus) {
            return this.eventBus; // Already initialized
        }
        this.config = config;

        const {
            region,
            eventBusName,
            mode = "hybrid",
            awsTopics = [],
            accessKeyId,
            secretAccessKey,
            maxRetries,
            retryDelay,
        } = config;

        switch (mode) {
            case "local":
                this.eventBus = new LocalEventBus();
                break;

            case "aws":
                this.eventBus = new AWSEventBus({
                    region,
                    eventBusName,
                    accessKeyId,
                    secretAccessKey,
                    maxRetries,
                    retryDelay,
                });
                break;

            case "hybrid":
            default: {
                // Build a HybridEventBusConfig
                const hybridConfig: HybridEventBusConfig = {
                    local: {
                        retry: {
                            maxRetries: 3,
                            backoffMultiplier: 2,
                            initialDelay: 100,
                        },
                    },
                    aws: {
                        region,
                        eventBusName,
                        accessKeyId,
                        secretAccessKey,
                        maxRetries,
                        retryDelay,
                    },
                    awsTopics,
                    mode: "hybrid",
                };
                this.eventBus = new HybridEventBus(hybridConfig);
                break;
            }
        }
        return this.eventBus;
    }

    public getEventBus(): EventBusAdapter {
        if (!this.eventBus) {
            throw new Error(
                "Event system not initialized. Call initialize() first.",
            );
        }
        return this.eventBus;
    }

    public getConfig(): AWSEventConfig {
        if (!this.config) {
            throw new Error("Event system not initialized.");
        }
        return this.config;
    }

    public reset(): void {
        this.eventBus = null;
        this.config = null;
    }
}

// Export the singleton
export const eventSystem = EventSystemManager.getInstance();
