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

export interface GreptileResponse {
    requestId: string;
    results: GreptileResult[];
    metadata: {
        totalResults: number;
        executionTime: number;
        query: string;
    };
}

export interface GreptileError {
    requestId: string;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export type ToolCapability =
    | "semanticSearch"
    | "codeGeneration"
    | "testing"
    | "documentation"
    | "refactoring"
    | "security"
    | "performance"
    | "debugging";

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
        period: "second" | "minute" | "hour" | "day";
    };
}

export interface ToolAuthentication {
    type: "apiKey" | "oauth" | "basic";
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

// Example implementation for Greptile semantic search
export interface GreptileConfig {
    apiKey: string;
    baseUrl?: string;
    maxResults?: number;
    searchOptions?: {
        caseSensitive: boolean;
        useRegex: boolean;
        includeTests: boolean;
    };
}

export interface GreptileResult {
    file: string;
    lineNumber: number;
    matchedText: string;
    score: number;
    context: string[];
}