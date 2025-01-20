import { Message } from "../messages";
import { GreptileResponse, GreptileResult, ToolResponse } from "../tools/greptile";

export type AIAgentRole =
    | "orchestrator"
    | "codeAnalysis"
    | "semanticSearch"
    | "documentation"
    | "testing"
    | "refactoring"
    | "security"
    | "unassigned";

export interface AIAgentCapability {
    type: string;
    description: string;
    requiredTools?: string[];
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
}

export interface AIAgentMetadata {
    id: string;
    name: string;
    role: AIAgentRole;
    version: string;
    capabilities: AIAgentCapability[];
    maxConcurrentTasks: number;
}

export interface AIAgentState {
    status: "idle" | "busy" | "error";
    currentTasks: string[];
    lastActivity: number;
    error?: {
        code: string;
        message: string;
    };
}

export interface AIAgentTask {
    id: string;
    type: string;
    priority: number;
    input: Record<string, unknown>;
    deadline?: number;
    parentTaskId?: string;
}

export interface AIAgentResult {
    taskId: string;
    success: boolean;
    output?:ToolResponse<GreptileResult | GreptileResult[]>;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    metrics?: {
        startTime: number;
        endTime: number;
        tokensUsed?: number;
    };
}

export interface AIAgentStateChangeEvent {
    agentId: string;
    state: AIAgentState;
}

export interface IAIAgent {
    readonly metadata: AIAgentMetadata;
    processTask(task: AIAgentTask): Promise<AIAgentResult>;
    handleSystemMessage(message: Message): Promise<void>;
    getState(): AIAgentState;
}
