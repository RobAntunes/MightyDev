// src/types/ai.ts

import { EventBusAdapter, EventPayload } from "./events";

// Define MessageContent to allow both string and array of objects
export type MessageContent = string | Array<{ type: string; content: string; language?: string; title?: string }>;

// Base message types
export interface AIMessageBase {
    role: "user" | "assistant" | "system";
    content: MessageContent;
}

export interface AIMessage extends AIMessageBase {
    id: string;
    timestamp: string;
    status: "pending" | "complete" | "error";
}


export interface AIRequestPayload {
    id: string; // Added ID field
    model: string;
    max_tokens: number;
    messages: AIMessage[];
}

export interface AIResponsePayload {
    id: string; // Added ID field
    text: string;
    model: string;
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

export interface AIErrorPayload {
    id: string; // Added ID field to map error to request
    error: string;
    code?: string;
    details?: unknown;
}

// Event types
export type AIRequestEvent = EventPayload<AIRequestPayload>;
export type AIResponseEvent = EventPayload<AIResponsePayload>;
export type AIErrorEvent = EventPayload<AIErrorPayload>;

// Service configuration
export interface ModelConfig {
    provider: "anthropic" | "openai";
    model: string;
    maxTokens?: number;
}

export interface AIServiceConfig {
    model: ModelConfig;
    eventBus: EventBusAdapter;
    maxContextLength?: number;
    retryConfig?: {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
    };
}

// Context tracking
export interface ConversationContext {
    messages: AIMessage[];
    metadata: {
        startTime: number;
        lastUpdateTime: number;
        tokens: {
            prompt: number;
            completion: number;
            total: number;
        };
    };
    projectContext?: {
        files: string[];
        dependencies: Record<string, string>;
    };
}

// Event map for type-safe event handling
export interface AIEventMap {
    "ai:request": {
        requestId: string;
        request: AIRequestEvent;
    };
    "ai:response": {
        requestId: string;
        response: AIResponseEvent;
    };
    "ai:error": {
        requestId: string;
        error: AIErrorPayload;
    };
}

// Stream handling
export interface CompletionStreamCallbacks {
    onChunk: (chunk: string) => void;
    onError?: (error: Error) => void;
    onComplete?: (response: AIResponseEvent) => void;
}

// Constants
export const AI_EVENTS = {
    REQUEST: "ai:request",
    RESPONSE: "ai:response",
    ERROR: "ai:error",
} as const;

// Base service interface
export abstract class AIService {
    abstract initialize(): Promise<void>;

    abstract getCompletion(
        request: AIRequestPayload,
        id: string,
    ): Promise<AIResponsePayload>;

    abstract streamCompletion(
        request: AIRequestPayload,
        callbacks: CompletionStreamCallbacks,
    ): Promise<void>;

    abstract updateContext(context: Partial<ConversationContext>): void;

    abstract getContext(): ConversationContext;

    abstract reset(): void;
}

// Type guard utilities
export function isErrorResponse(response: unknown): response is AIErrorEvent {
    return typeof response === 'object' && 
           response !== null && 
           'error' in response &&
           'id' in response;
}

export function isAIMessage(message: unknown): message is AIMessage {
    return typeof message === 'object' && 
           message !== null && 
           'role' in message && 
           'content' in message &&
           'id' in message &&
           'timestamp' in message &&
           'status' in message;
}

export function isAIRequestMessage(message: unknown): message is AIMessage {
    return typeof message === 'object' && 
           message !== null && 
           'role' in message && 
           'content' in message;
}