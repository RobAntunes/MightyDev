import { AITool, ToolMetadata } from "../../types/tools/base";
import { EventBusAdapter } from "../..//types/events";
import { eventSystem } from "../../classes/events/manager";
import { GreptileConfig } from "../../types/tools/greptile";

export class GreptileIntegration implements AITool<GreptileConfig> {
    readonly metadata: ToolMetadata = {
        name: 'Greptile',
        version: '1.0.0',
        capabilities: ['semanticSearch'],
        requiresAuthentication: true,
        supportedLanguages: ['*'],
        rateLimit: {
            requests: 100,
            period: 'minute'
        }
    };

    readonly eventBus: EventBusAdapter;
    private config!: GreptileConfig;
    private initialized: boolean = false;

    constructor() {
        this.eventBus = eventSystem.getEventBus();
    }

    async initialize(config: GreptileConfig): Promise<void> {
        const isValid = await this.validateConfig(config);
        if (!isValid) {
            throw new Error('Invalid Greptile configuration');
        }
        
        this.config = config;
        this.initialized = true;
    }

    async validateConfig(config: GreptileConfig): Promise<boolean> {
        return Boolean(config.apiKey);
    }

    async testConnection(): Promise<boolean> {
        try {
            const response = await fetch(`${this.config.baseUrl || 'https://api.greptile.com'}/ping`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`
                }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    getConfig(): GreptileConfig {
        if (!this.initialized) {
            throw new Error('Greptile not initialized');
        }
        return this.config;
    }
}