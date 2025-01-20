// src/types/ai.ts

import { Message } from "./messages";
import { EventBusAdapter } from "./events";
import { UUID } from "crypto";
import { Auth0ContextInterface } from "@auth0/auth0-react";

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

export interface CompletionRequest {
    id: UUID;
    messages: Message[];
    maxTokens?: number;
}

export interface CompletionResponse {
    message: Message;
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface AIEventMap {
    "ai:request": {
        requestId: string;
        request: CompletionRequest;
    };
    "ai:response": {
        requestId: string;
        response: CompletionResponse;
    };
    "ai:error": {
        requestId: string;
        error: string;
    };
}

export interface ConversationContext {
    messages: Message[];
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

export interface CompletionStreamCallbacks {
    onChunk: (chunk: string) => void;
    onError?: (error: Error) => void;
    onComplete?: (response: CompletionResponse) => void;
}

export abstract class AIService {
    abstract initialize(): Promise<void>;
    abstract getCompletion(
        request: CompletionRequest,
        auth0: Auth0ContextInterface,
    ): Promise<CompletionResponse>;
    abstract streamCompletion(
        request: CompletionRequest,
        callbacks: CompletionStreamCallbacks,
    ): Promise<void>;
    abstract updateContext(context: Partial<ConversationContext>): void;
    abstract getContext(): ConversationContext;
    abstract reset(): void;
}
