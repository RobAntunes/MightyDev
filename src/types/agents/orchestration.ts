// types/orchestration.ts

import {
    AIAgentResult,
    AIAgentStateChangeEvent,
    AIAgentTask,
} from "../agents/base";
import {
    GreptileError,
    GreptileResponse,
    GreptileSearchRequest,
} from "../tools/greptile";
import { Message } from "../messages";
import { AIEventMap } from "../ai";

// Define all possible event types for type safety
export interface OrchestrationEventMap {
    // Task Management Events
    "task:created": AIAgentTask;
    "task:assigned": { taskId: string; agentId: string };
    "task:completed": AIAgentResult;
    "task:failed": { taskId: string; error: Error };

    // Agent Lifecycle Events
    "agent:initialized": { agentId: string; role: string };
    "agent:stateChanged": AIAgentStateChangeEvent;
    "agent:error": { agentId: string; error: Error };

    // Tool Integration Events
    "tool:registered": { name: string; capabilities: string[] };
    "tool:unregistered": { name: string };
    "tool:error": { name: string; error: Error };

    // Greptile Specific Events
    "greptile:search": GreptileSearchRequest;
    "greptile:results": GreptileResponse;
    "greptile:error": GreptileError;

    // System Events
    "system:ready": { timestamp: number };
    "system:shutdown": { reason: string };
    "system:error": {
        error: Error;
        severity: "low" | "medium" | "high" | "critical";
    };

    // Context Events
    "context:updated": { contextId: string; changes: Record<string, unknown> };
    "context:cleared": { contextId: string };

    // Message Events
    "message:received": Message;
    "message:processed": { messageId: string; result: any };

    // General AI events (TEMP)
    "ai:request": AIEventMap["ai:request"];
    "ai:response": AIEventMap["ai:response"];
    "ai:error": AIEventMap["ai:error"];
}

// Type guard to check if an event exists in our event map
export function isValidOrchestrationEvent(
    event: string,
): event is keyof OrchestrationEventMap {
    return event in OrchestrationEventMap;
}

// Helper type for event handlers
export type OrchestrationEventHandler<T extends keyof OrchestrationEventMap> = (
    data: OrchestrationEventMap[T],
) => Promise<void>;

// Event subscription manager
export class OrchestrationEventManager {
    private handlers: Map<
        keyof OrchestrationEventMap,
        Set<OrchestrationEventHandler<any>>
    > = new Map();

    subscribe<T extends keyof OrchestrationEventMap>(
        event: T,
        handler: OrchestrationEventHandler<T>,
    ): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }

        this.handlers.get(event)!.add(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(event);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.handlers.delete(event);
                }
            }
        };
    }

    async emit<T extends keyof OrchestrationEventMap>(
        event: T,
        data: OrchestrationEventMap[T],
    ): Promise<void> {
        const handlers = this.handlers.get(event);
        if (handlers) {
            await Promise.all(
                Array.from(handlers).map((handler) => handler(data)),
            );
        }
    }

    // Get all registered event types
    getRegisteredEvents(): Array<keyof OrchestrationEventMap> {
        return Array.from(this.handlers.keys());
    }

    // Clear all handlers for an event
    clearEvent(event: keyof OrchestrationEventMap): void {
        this.handlers.delete(event);
    }

    // Clear all handlers
    clearAll(): void {
        this.handlers.clear();
    }
}

// Task routing configuration for the orchestrator
export interface TaskRoutingConfig {
    priorityRules: Array<{
        condition: (task: AIAgentTask) => boolean;
        priority: number;
    }>;
    agentSelectionRules: Array<{
        condition: (task: AIAgentTask, agentRole: string) => boolean;
        weight: number;
    }>;
}

// Helper to create a task routing configuration
export function createDefaultTaskRouting(): TaskRoutingConfig {
    return {
        priorityRules: [
            {
                condition: (task) => task.type === "security",
                priority: 100,
            },
            {
                condition: (task) => task.type === "error",
                priority: 90,
            },
            {
                condition: (task) => task.type === "userRequest",
                priority: 80,
            },
        ],
        agentSelectionRules: [
            {
                condition: (task, role) =>
                    task.type === "semanticSearch" && role === "searchAgent",
                weight: 1.0,
            },
            {
                condition: (task, role) =>
                    task.type === "codeAnalysis" && role === "analysisAgent",
                weight: 1.0,
            },
        ],
    };
}
