import { LatentAgent } from "@/classes/agents/Pool";
import { AIAgentCapability, AIAgentResult, AIAgentRole, AIAgentTask } from "./base";

export interface AgentPoolConfig {
    minAgents: number;
    maxAgents: number;
    idleTimeout: number; // ms before scaling down an idle agent
    warmupThreshold: number; // load percentage to trigger scale up
    scaleStepSize: number; // how many agents to add/remove at once
}

export interface AgentPoolMetrics {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    queuedTasks: number;
    averageResponseTime: number;
    resourceUtilization: number;
}

// Represents a specialist role with its own scaling rules
export interface SpecialistRole {
    role: AIAgentRole;
    minAgents: number;
    maxAgents: number;
    currentLoad: number;
    agents: Set<LatentAgent>;
}

// Specialized task handlers for each role
export interface RoleTaskHandlers {
    architect: (task: AIAgentTask) => Promise<AIAgentResult>;
    designer: (task: AIAgentTask) => Promise<AIAgentResult>;
    coder: (task: AIAgentTask) => Promise<AIAgentResult>;
    reviewer: (task: AIAgentTask) => Promise<AIAgentResult>;
    qa: (task: AIAgentTask) => Promise<AIAgentResult>;
    toolUser: (task: AIAgentTask) => Promise<AIAgentResult>;
}

export interface AgentPoolConfig {
    minAgents: number;
    maxAgents: number;
    idleTimeout: number;
    warmupThreshold: number;
    scaleStepSize: number;
}

export interface AgentPoolMetrics {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    queuedTasks: number;
    averageResponseTime: number;
    resourceUtilization: number;
}

// Define the interface for role-specific task handlers
export interface RoleTaskHandlers {
    [key: string]: (task: AIAgentTask) => Promise<AIAgentResult>;
    architect: (task: AIAgentTask) => Promise<AIAgentResult>;
    designer: (task: AIAgentTask) => Promise<AIAgentResult>;
    coder: (task: AIAgentTask) => Promise<AIAgentResult>;
    reviewer: (task: AIAgentTask) => Promise<AIAgentResult>;
    qa: (task: AIAgentTask) => Promise<AIAgentResult>;
    toolUser: (task: AIAgentTask) => Promise<AIAgentResult>;
}

// Extend AIAgentRole to include all possible roles
// Helper type for extracting capability types by role
export type RoleCapabilities = {
    [K in AIAgentRole as string]: AIAgentCapability[];
};

export interface AgentPoolConfig {
    minAgents: number;
    maxAgents: number;
    idleTimeout: number;
    warmupThreshold: number;
    scaleStepSize: number;
}

export interface AgentPoolMetrics {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    queuedTasks: number;
    averageResponseTime: number;
    resourceUtilization: number;
}