// src/services/ai/AnthropicService.ts

import {
    AIErrorEvent,
    AIErrorPayload,
    AIMessage,
    AIRequestPayload,
    AIResponsePayload,
    AIService,
    AIServiceConfig,
    CompletionStreamCallbacks,
    ConversationContext,
} from "../../types/ai";
import { eventSystem } from "../../classes/events/manager";
import { invokeWithAuth } from "../../lib/auth";
import { Auth0ContextInterface } from "@auth0/auth0-react";

interface AnthropicResponse {
    content: Array<{
        text: string;
        type: "text";
    }>;
    id: string;
    model: string;
    role: "assistant";
    type: "message";
    usage?: {
        input_tokens: number;
        output_tokens: number;
    };
}

export class AnthropicService implements AIService {
    private config: AIServiceConfig;
    private initialized = false;
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

    constructor(config: AIServiceConfig, private auth0: Auth0ContextInterface) {
        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.model?.model) {
            console.warn(
                "Warning: No model specified in config. Using default: claude-3-5-sonnet-20241022",
            );
            this.config.model = this.config.model || {
                model: "claude-3-5-sonnet-20241022",
                provider: "anthropic",
                maxTokens: 1024,
            };
        }
        this.initialized = true;
    }

    private transformMessage(
        msg: AIMessage,
    ): { role: string; content: string } {
        let transformedContent: string;

        if (Array.isArray(msg.content)) {
            transformedContent = msg.content
                .map((c) => {
                    switch (c.type) {
                        case "text":
                            return c.content;
                        case "error":
                            return `Error: ${c.content}`;
                        case "code":
                            return `Code (${
                                c.language || "plaintext"
                            }):\n${c.content}`;
                        default:
                            return c.content;
                    }
                })
                .join("\n");
        } else {
            transformedContent = msg.content;
        }

        return {
            role: msg.role,
            content: transformedContent,
        };
    }

    async getCompletion(
        request: AIRequestPayload,
    ): Promise<AIResponsePayload> {
        if (!this.initialized) {
            throw new Error("AnthropicService: Not initialized");
        }

        try {
            const anthropicMessages = request.messages.map(
                (m) => this.transformMessage(m),
            );

            const anthropicRequest = {
                id: request.id,
                model: this.config.model.model,
                max_tokens: this.config.model.maxTokens || 1024,
                messages: anthropicMessages,
            };

            console.log("Sending to Anthropic:", anthropicRequest);

            const response = await invokeWithAuth(
                "anthropic_completion",
                {
                    request: anthropicRequest,
                },
                this.auth0,
                true,
            );

            const parsedResponse: AnthropicResponse = JSON.parse(response);

            // Transform the Anthropic response to our internal format
            const aiResponse: AIResponsePayload = {
                id: request.id,
                text: parsedResponse.content[0]?.text || "",
                model: parsedResponse.model,
                usage: parsedResponse.usage
                    ? {
                        input_tokens: parsedResponse.usage.input_tokens,
                        output_tokens: parsedResponse.usage.output_tokens
                    }
                    : undefined,
            };

            // Publish response event
            await eventSystem.getEventBus().publish(
                "ai:response",
                aiResponse,
                "anthropic_completion",
            );

            return aiResponse;
        } catch (error: any) {
            console.error("AnthropicService getCompletion error:", error);

            // Publish error event with request ID
            const errorEvent: AIErrorPayload = {
                ...error,
            };

            await eventSystem.getEventBus().publish(
                "ai:error",
                errorEvent,
                "anthropic_completion",
            );

            throw new Error(error.message || "Unknown error occurred");
        }
    }

    async streamCompletion(
        _request: AIRequestPayload,
        _callbacks: CompletionStreamCallbacks,
    ): Promise<void> {
        throw new Error("AnthropicService: Streaming not implemented");
    }

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

export function createAnthropicService(
    config: AIServiceConfig,
    auth0: Auth0ContextInterface,
): AIService {
    return new AnthropicService(config, auth0);
}
