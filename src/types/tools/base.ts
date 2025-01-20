// src/services/ai/tools/base.ts

import { EventBusAdapter } from "@/types/events";
import { eventSystem } from "../../classes/events/manager";
import { Auth0ContextInterface } from "@auth0/auth0-react";

export type ToolCapability = 
    | 'semanticSearch'
    | 'codeGeneration'
    | 'testing'
    | 'documentation'
    | 'refactoring'
    | 'security'
    | 'performance'
    | 'debugging';

export interface ToolMetadata {
    name: string;
    version: string;
    capabilities: ToolCapability[];
    requiresAuthentication: boolean;
    apiEndpoint?: string;
    supportedLanguages?: string[];
    maxContextSize?: number;
    rateLimit?: {
        requests: number;
        period: 'second' | 'minute' | 'hour' | 'day'
    };
}

export interface AITool<TConfig = unknown, TResult = unknown> {
    readonly metadata: ToolMetadata;
    readonly eventBus: EventBusAdapter;
    
    initialize(config: TConfig): Promise<void>;
    validateConfig(config: TConfig, auth0: Auth0ContextInterface): Promise<boolean>;
    testConnection(auth0: Auth0ContextInterface): Promise<boolean>;
    getConfig(): TConfig;
}


export interface ToolAuthentication {
    type: 'apiKey' | 'oauth' | 'basic';
    credentials: Record<string, string>;
}

export interface ToolResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    metadata?: {
        executionTime: number;
        usageMetrics?: Record<string, number>;
    };
}


// Tool registry for managing multiple AI tools
export class AIToolRegistry {
    private tools = new Map<string, AITool>();
    private eventBus: EventBusAdapter;

    constructor() {
        this.eventBus = eventSystem.getEventBus();
    }

    registerTool(name: string, tool: AITool): void {
        this.tools.set(name, tool);
        
        // Publish tool registration event
        this.eventBus.publish(
            'tools:registered',
            {
                name,
                metadata: tool.metadata
            },
            'tool-registry'
        );
    }

    getTool<T extends AITool>(name: string): T {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return tool as T;
    }

    listTools(): ToolMetadata[] {
        return Array.from(this.tools.values()).map(tool => tool.metadata);
    }

    findToolsByCapability(capability: ToolCapability): AITool[] {
        return Array.from(this.tools.values())
            .filter(tool => tool.metadata.capabilities.includes(capability));
    }
}