// src/services/ai/AnthropicService.ts
import {
    AIService,
    AIServiceConfig,
    CompletionRequest,
    CompletionResponse,
    CompletionStreamCallbacks,
    ConversationContext,
} from "../../types/ai";
import { Message } from "../../types/messages";
import { eventSystem } from "../../classes/events/manager";
import { invokeWithAuth } from "../../lib/auth";
import { Auth0ContextInterface, withAuth0 } from "@auth0/auth0-react";

// Each message must be { role: "user" | "assistant", content: string }
interface AnthropicMessage {
    role: "user" | "assistant";
    content: string;
}

// This is the shape we send to Rust via `invoke("anthropic_completion")`
interface AnthropicRequest {
    model: string;
    max_tokens: number;
    messages: AnthropicMessage[];
    auth0: Auth0ContextInterface,
}

export class AnthropicService implements AIService {
    private config: AIServiceConfig;
    private initialized = false;
    public auth0 = {};

    // If you no longer need context-tracking, feel free to remove
    private context: ConversationContext = {
        messages: [],
        metadata: {
            startTime: Date.now(),
            lastUpdateTime: Date.now(),
            tokens: {
                prompt: 0,
                completion: 0,
                total: 0,
            },
        },
    };

    constructor(config: AIServiceConfig, auth0: Auth0ContextInterface) {
        this.config = config;
        this.auth0 = auth0;
    }

    /**
     * If you have any setup tasks (like validating config or keys),
     * do them here. Otherwise, just mark the service as ready.
     */
    async initialize(): Promise<void> {
        // For example: validate that config.model?.model is set
        if (!this.config.model?.model) {
            console.warn(
                "Warning: No model specified in config. Using default: claude-3-5-sonnet-20241022",
            );
        }
        this.initialized = true;
    }

    /**
     * Convert each Message in your app’s format to Anthropic’s expected shape.
     */
    private transformMessage(msg: Message): AnthropicMessage {
        // 1) Ensure msg.content is always an array
        const contents = Array.isArray(msg.content)
            ? msg.content
            : [msg.content];
        // 2) Filter & join text content

        return {
            role: msg.role === "user" ? "user" : "assistant",
            content: contents.join("\n"),
        };
    }

    /**
     * One-shot completion request using Anthropic’s API (via Tauri Rust command).
     */
    async getCompletion(
        request: CompletionRequest,
        auth0: Auth0ContextInterface,
    ): Promise<CompletionResponse> {
        if (!this.initialized) {
            throw new Error("AnthropicService: Not initialized");
        }

        try {
            // 1) Transform your messages to Anthropic’s shape
            const anthropicMessages: AnthropicMessage[] = request.messages.map(
                (m) => this.transformMessage(m),
            );
            console.log(anthropicMessages);

            // 2) Build the request object
            const anthropicRequest: AnthropicRequest = {
                model: this.config.model?.model || "claude-3-5-sonnet-20241022",
                max_tokens: request.maxTokens || 1024,
                messages: anthropicMessages,
                auth0
            };

            console.log("Sending to Anthropic:", anthropicRequest);

            // 3) Call Tauri’s Rust command, which calls Anthropic’s endpoint
            const aiText = await invokeWithAuth("anthropic_completion", {
                request: anthropicRequest,
            }, auth0);
           eventSystem.getEventBus().publish(
                "ai:response",
                { text: aiText },
                "anthropic_completion",
            );
            // 4) Wrap the raw AI text in your standard `Message` shape
            const aiMessage: Message = {
                id: crypto.randomUUID(),
                role: "assistant",
                timestamp: new Date().toISOString(),
                status: "complete",
                content: [
                    {
                        type: "text",
                        content: aiText,
                    },
                ],
            };

            // 5) Return a `CompletionResponse`
            return {
                message: aiMessage,
                usage: {
                    promptTokens: 0,
                    completionTokens: 0,
                    totalTokens: 0,
                },
            };
        } catch (error) {
            console.error(
                error,
            );
            throw error;
        }
    }

    /**
     * Streaming is not implemented yet.
     * (If you eventually want to do SSE or token streaming, implement here.)
     */
    async streamCompletion(
        _request: CompletionRequest,
        _callbacks: CompletionStreamCallbacks,
    ): Promise<void> {
        throw new Error("AnthropicService: Streaming not implemented");
    }

    /**
     * (Optional) If you want to store conversation context (messages, tokens, etc.)
     * between calls, update it here.
     * You can remove if you don’t need any session context logic.
     */
    updateContext(newContext: Partial<ConversationContext>): void {
        this.context = {
            ...this.context,
            ...newContext,
            metadata: {
                ...this.context.metadata,
                ...(newContext.metadata || {}),
                lastUpdateTime: Date.now(),
            },
        };
    }

    getContext(): ConversationContext {
        return this.context;
    }

    reset(): void {
        this.context = {
            messages: [],
            metadata: {
                startTime: Date.now(),
                lastUpdateTime: Date.now(),
                tokens: {
                    prompt: 0,
                    completion: 0,
                    total: 0,
                },
            },
        };
    }
}

/**
 * If you prefer a factory style:
 */
export const createAnthropicService = (config: AIServiceConfig, auth0: Auth0ContextInterface): AIService => {
    return new AnthropicService(config, auth0);
};
