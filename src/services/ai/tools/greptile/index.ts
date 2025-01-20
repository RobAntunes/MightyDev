import { AITool, ToolMetadata, ToolResponse } from "@/types/tools/base";
import { EventBusAdapter } from "@/types/events";
import { eventSystem } from "../../../../classes/events/manager";
import { GreptileConfig } from "@/types/tools/greptile";
import { invokeWithAuth } from "../../../../lib/auth";
import { Auth0Context, Auth0ContextInterface } from "@auth0/auth0-react";

// Greptile frontend types - notice we don't include API key here
export interface GreptileServiceConfig {
    maxResults?: number;
    searchOptions?: {
        caseSensitive: boolean;
        useRegex: boolean;
        includeTests: boolean;
    };
}

export interface GreptileSearchRequest {
    id: string;
    query: string;
    options?: {
        maxResults?: number;
        caseSensitive?: boolean;
        useRegex?: boolean;
        includeTests?: boolean;
    };
}

export interface GreptileResult {
    file: string;
    lineNumber: number;
    matchedText: string;
    score: number;
    context: string[];
}

export interface GreptileResponse {
    results: GreptileResult[];
    metadata: {
        totalResults: number;
        executionTime: number;
        query: string;
    };
}

export class GreptileService
    implements AITool<GreptileServiceConfig, GreptileResult[]> {
    readonly metadata: ToolMetadata = {
        name: "Greptile",
        version: "1.0.0",
        capabilities: ["semanticSearch"],
        requiresAuthentication: false, // Authentication handled by backend
        supportedLanguages: ["*"],
        rateLimit: {
            requests: 100,
            period: "minute",
        },
    };
    private auth0: Auth0ContextInterface;
    private config!: GreptileServiceConfig;
    private initialized = false;
    public eventBus: EventBusAdapter;

    constructor(auth0: Auth0ContextInterface) {
        this.eventBus = eventSystem.getEventBus();
        this.auth0 = auth0;
    }

    async initialize(
        config: GreptileServiceConfig,
    ): Promise<void> {
        this.config = config;
        this.initialized = true;

        await this.eventBus.publish(
            "tools:initialized",
            {
                tool: "greptile",
                config: this.config,
            },
            "greptile-service",
        );
    }

    async search(
        request: GreptileSearchRequest,
        auth0: Auth0ContextInterface,
    ): Promise<ToolResponse<GreptileResult[]>> {
        if (!this.initialized) {
            throw new Error("Greptile service not initialized");
        }

        const startTime = Date.now();

        try {
            await this.eventBus.publish(
                "greptile:searchStarted",
                {
                    requestId: request.id,
                    query: request.query,
                },
                "greptile-service",
            );

            // Invoke backend search command
            const response = await invokeWithAuth("greptile_search", {
                request: {
                    query: request.query,
                    options: {
                        maxResults: request.options?.maxResults ||
                            this.config.maxResults,
                        caseSensitive: request.options?.caseSensitive,
                        useRegex: request.options?.useRegex,
                        includeTests: request.options?.includeTests,
                    },
                },
            }, auth0);

            const executionTime = Date.now() - startTime;

            await this.eventBus.publish(
                "greptile:searchCompleted",
                {
                    requestId: request.id,
                    results: response.results,
                    metadata: {
                        executionTime,
                        totalResults: response.results.length,
                        query: request.query,
                    },
                },
                "greptile-service",
            );

            return {
                success: true,
                data: response.results,
                metadata: {
                    executionTime,
                    usageMetrics: {
                        resultsCount: response.results.length,
                        queryLength: request.query.length,
                    },
                },
            };
        } catch (error) {
            const errorResponse = {
                code: "SEARCH_FAILED",
                message: error instanceof Error
                    ? error.message
                    : "Unknown error occurred",
                details: error,
            };

            await this.eventBus.publish(
                "greptile:error",
                errorResponse,
                "greptile-service",
            );

            return {
                success: false,
                error: errorResponse,
            };
        }
    }

    getConfig(): GreptileServiceConfig {
        if (!this.initialized) {
            throw new Error("Greptile service not initialized");
        }
        return { ...this.config };
    }

    private async handleError(code: string, error: unknown) {
        const errorResponse = {
            code,
            message: error instanceof Error
                ? error.message
                : "Unknown error occurred",
            details: error,
        };

        await this.eventBus.publish(
            "greptile:error",
            errorResponse,
            "greptile-service",
        );

        return errorResponse;
    }

    // getAgent(): GreptileAgent {
    //     return this.agent;
    // }

    async validateConfig(
        config: GreptileConfig,
        auth0: Auth0ContextInterface,
    ): Promise<boolean> {
        if (!config.apiKey) {
            return false;
        }
        return this.testConnection(auth0);
    }

    async testConnection(auth0: Auth0ContextInterface): Promise<boolean> {
        if (!this.initialized) {
            return false;
        }

        try {
            return await invokeWithAuth("test_greptile_connection", {
                config: this.config,
            }, auth0);
        } catch (error) {
            await this.handleError("CONNECTION_TEST_FAILED", error);
            return false;
        }
    }
}

// Factory function to create and initialize the service
export async function createGreptileService(
    config: GreptileServiceConfig,
    auth0: Auth0ContextInterface,
): Promise<GreptileService> {
    const service = new GreptileService(auth0);
    await service.initialize(config);
    return service;
}
