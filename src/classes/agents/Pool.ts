import { EventBusAdapter } from "@/types/events";
import { Message } from "@/types/messages";
import { AIAgent } from "./Agent";
import {
    AIAgentCapability,
    AIAgentMetadata,
    AIAgentResult,
    AIAgentRole,
    AIAgentState,
    AIAgentTask,
    IAIAgent,
} from "@/types/agents/base";
import {
    AgentPoolConfig,
    AgentPoolMetrics,
    RoleCapabilities,
    RoleTaskHandlers,
    SpecialistRole,
} from "@/types/agents/pool";

// Define available agent roles

export class LatentAgent extends AIAgent {
    private currentRole: AIAgentRole | null = null;
    private lastActiveTime: number = Date.now();
    private specializations: Set<AIAgentRole> = new Set();
    private performance: Map<AIAgentRole, number> = new Map();
    public metadata: AIAgentMetadata;
    private taskHandlers: RoleTaskHandlers;

    constructor(
        id: string,
        private pool: AgentPool,
        eventBus: EventBusAdapter,
    ) {
        super({
            id,
            name: `Latent Agent ${id}`,
            role: "unassigned",
            version: "1.0",
            capabilities: [],
            maxConcurrentTasks: 1,
        }, eventBus);

        this.metadata = {
            id,
            name: `Latent Agent ${id}`,
            role: "unassigned",
            version: "1.0",
            capabilities: this.getCapabilitiesForRole("unassigned"),
            maxConcurrentTasks: 1,
        };

        // Initialize task handlers for each role
        this.taskHandlers = {
            architect: this.handleArchitectTask.bind(this),
            designer: this.handleDesignTask.bind(this),
            coder: this.handleCoderTask.bind(this),
            reviewer: this.handleReviewerTask.bind(this),
            qa: this.handleQATask.bind(this),
            toolUser: this.handleToolUserTask.bind(this),
        };
    }

    protected getCapabilitiesForRole(role: AIAgentRole): AIAgentCapability[] {
        const baseCapabilities: AIAgentCapability[] = [{
            type: "contextAwareness",
            description: "Understands project context",
        }];

        const roleCapabilities: RoleCapabilities = {
            unassigned: [],
            architect: [
                {
                    type: "systemDesign",
                    description: "High-level system architecture",
                },
                {
                    type: "technicalPlanning",
                    description: "Technical decision making",
                },
            ],
            designer: [
                {
                    type: "uiDesign",
                    description: "User interface design",
                },
                {
                    type: "uxPlanning",
                    description: "User experience planning",
                },
            ],
            coder: [
                {
                    type: "implementation",
                    description: "Code implementation",
                },
            ],
            reviewer: [
                {
                    type: "codeReview",
                    description: "Code review and analysis",
                },
            ],
            qa: [
                {
                    type: "testing",
                    description: "Quality assurance and testing",
                },
            ],
            toolUser: [
                {
                    type: "toolExecution",
                    description: "External tool integration",
                },
            ],
        };

        return [...baseCapabilities, ...(roleCapabilities[role] || [])];
    }

    async handleSystemMessage(message: Message): Promise<void> {
        // Handle system messages based on current role
        switch (this.currentRole) {
            case "architect" as AIAgentRole:
                await this.handleArchitectSystemMessage(message);
                break;
            case "designer" as AIAgentRole:
                await this.handleDesignerSystemMessage(message);
                break;
            // ... handle other roles
            default:
                console.log(
                    `Unhandled system message for role: ${this.currentRole}`,
                );
        }
    }

    async assignRole(role: AIAgentRole): Promise<void> {
        this.currentRole = role;
        this.lastActiveTime = Date.now();

        // Create new metadata object instead of modifying readonly property
        const newMetadata = {
            ...this.metadata,
            role,
            capabilities: this.getCapabilitiesForRole(role),
        };

        // Use protected method from parent class to update metadata
        this.metadata = newMetadata;

        await this.eventBus.publish("agent:roleAssigned", {
            agentId: this.metadata.id,
            role,
        }, "agent-pool");
    }

    async processTask(task: AIAgentTask): Promise<AIAgentResult> {
        this.lastActiveTime = Date.now();
        const startTime = Date.now();

        try {
            if (!this.currentRole || !this.taskHandlers[this.currentRole]) {
                throw new Error(`No handler for role: ${this.currentRole}`);
            }

            const result = await this.taskHandlers[this.currentRole](task);
            this.updatePerformanceMetrics(task.type, startTime);
            return result;
        } catch (error) {
            return {
                taskId: task.id,
                success: false,
                error: {
                    code: "TASK_EXECUTION_FAILED",
                    message: error instanceof Error
                        ? error.message
                        : "Unknown error",
                },
            };
        }
    }

    // Implement task handlers for each role
    private async handleArchitectTask(
        task: AIAgentTask,
    ): Promise<AIAgentResult> {
        // Implement architect-specific task handling
        return {
            taskId: task.id,
            success: true,
            // output: {
            //     Architecture-specific output
            // },
        };
    }

    private async handleDesignTask(task: AIAgentTask): Promise<AIAgentResult> {
        // Implement designer-specific task handling
        return {
            taskId: task.id,
            success: true,
            // output: {
            // Design-specific output
            // },
        };
    }

    // ... implement other role-specific task handlers ...
    private async handleCoderTask(task: AIAgentTask): Promise<AIAgentResult> {
        return { taskId: task.id, success: true };
    }

    private async handleReviewerTask(
        task: AIAgentTask,
    ): Promise<AIAgentResult> {
        return { taskId: task.id, success: true };
    }

    private async handleQATask(task: AIAgentTask): Promise<AIAgentResult> {
        return { taskId: task.id, success: true };
    }

    private async handleToolUserTask(
        task: AIAgentTask,
    ): Promise<AIAgentResult> {
        return { taskId: task.id, success: true };
    }

    // Implement system message handlers for each role
    private async handleArchitectSystemMessage(
        message: Message,
    ): Promise<void> {
        // Handle architect-specific system messages
    }

    private async handleDesignerSystemMessage(message: Message): Promise<void> {
        // Handle designer-specific system messages
    }

    private updatePerformanceMetrics(
        taskType: string,
        startTime: number,
    ): void {
        if (!this.currentRole) return;

        const executionTime = Date.now() - startTime;
        const currentScore = this.performance.get(this.currentRole) || 1.0;

        const newScore = (currentScore * 0.7) + (0.3 * (1000 / executionTime));
        this.performance.set(this.currentRole, newScore);

        if (newScore > 1.2) {
            this.specializations.add(this.currentRole);
        }
    }

    getIdleTime(): number {
        return Date.now() - this.lastActiveTime;
    }

    getPerformanceScore(role: AIAgentRole): number {
        return this.performance.get(role) || 1.0;
    }

    isSpecializedFor(role: AIAgentRole): boolean {
        return this.specializations.has(role);
    }
}

// AgentPool class implementation remains largely the same,
// but with updated type references to use keyof AIAgentRole
export class AgentPool {
    private agents: Map<string, LatentAgent> = new Map();
    private taskQueue: AIAgentTask[] = [];
    private specialistRoles: Map<AIAgentRole, SpecialistRole> = new Map();
    private metrics: AgentPoolMetrics = {
        totalAgents: 0,
        activeAgents: 0,
        idleAgents: 0,
        queuedTasks: 0,
        averageResponseTime: 0,
        resourceUtilization: 0,
    };

    constructor(
        private config: AgentPoolConfig,
        private eventBus: EventBusAdapter,
    ) {
        this.initializePool();
        this.startMetricsCollection();
    }

    private async initializePool(): Promise<void> {
        // Create initial agent pool
        for (let i = 0; i < this.config.minAgents; i++) {
            await this.createAgent();
        }

        // Initialize specialist roles
        this.initializeSpecialistRoles();

        // Start monitoring for scale events
        this.startScalingMonitor();
    }

    private async createAgent(): Promise<LatentAgent> {
        const agent = new LatentAgent(
            `agent-${crypto.randomUUID()}`,
            this,
            this.eventBus,
        );

        this.agents.set(agent.metadata.id, agent);
        this.metrics.totalAgents++;

        await this.eventBus.publish("agent:created", {
            agentId: agent.metadata.id,
        }, "agent-pool");

        return agent;
    }

    private initializeSpecialistRoles(): void {
        const roles: AIAgentRole[] = [
            "architect" as AIAgentRole,
            "designer" as AIAgentRole,
            "coder" as AIAgentRole,
            "reviewer" as AIAgentRole,
            "qa" as AIAgentRole,
            "toolUser" as AIAgentRole,
        ];

        roles.forEach((role) => {
            this.specialistRoles.set(role, {
                role,
                minAgents: 1,
                maxAgents: 5,
                currentLoad: 0,
                agents: new Set(),
            });
        });
    }

    public async assignTask(task: AIAgentTask): Promise<void> {
        const role = this.determineRequiredRole(task);
        const specialist = this.specialistRoles.get(role);

        if (!specialist) {
            throw new Error(
                `No specialist role configured for task type: ${task.type}`,
            );
        }

        // Try to find an available specialized agent
        let assignedAgent = this.findAvailableSpecialist(role);

        if (!assignedAgent) {
            // Try to recruit a new specialist
            assignedAgent = await this.recruitSpecialist(role);
        }

        if (assignedAgent) {
            await assignedAgent.processTask(task);
        } else {
            // Queue task for later processing
            this.taskQueue.push(task);
            this.checkScalingNeeds();
        }
    }

    private findAvailableSpecialist(role: AIAgentRole): LatentAgent | null {
        const specialist = this.specialistRoles.get(role);
        if (!specialist) return null;

        // First try to find an idle specialized agent
        for (const agent of specialist.agents) {
            if (
                agent.getState().status === "idle" &&
                agent.isSpecializedFor(role)
            ) {
                return agent;
            }
        }

        return null;
    }

    private async recruitSpecialist(
        role: AIAgentRole,
    ): Promise<LatentAgent | null> {
        // First try to find an idle agent to repurpose
        const idleAgent = Array.from(this.agents.values())
            .find((agent) => agent.getState().status === "idle");

        if (idleAgent) {
            await idleAgent.assignRole(role);
            return idleAgent;
        }

        // If we can scale up, create a new agent
        if (this.canScaleUp()) {
            const newAgent = await this.createAgent();
            await newAgent.assignRole(role);
            return newAgent;
        }

        return null;
    }

    private determineRequiredRole(task: AIAgentTask): AIAgentRole {
        // Implement logic to determine the required role based on task type
        // This could be enhanced with ML-based classification
        switch (task.type) {
            case "systemDesign":
                return "architect" as AIAgentRole;
            case "uiDesign":
                return "designer" as AIAgentRole;
            case "implementation":
                return "coder" as AIAgentRole;
            case "codeReview":
                return "reviewer" as AIAgentRole;
            case "testing":
                return "qa" as AIAgentRole;
            case "toolExecution" as AIAgentRole:
                return "toolUser" as AIAgentRole;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    private canScaleUp(): boolean {
        return this.agents.size < this.config.maxAgents;
    }

    private async checkScalingNeeds(): Promise<void> {
        const currentLoad = this.calculateCurrentLoad();

        if (currentLoad > this.config.warmupThreshold && this.canScaleUp()) {
            // Scale up by creating new agents
            for (let i = 0; i < this.config.scaleStepSize; i++) {
                if (this.canScaleUp()) {
                    await this.createAgent();
                }
            }
        }
    }

    private calculateCurrentLoad(): number {
        const activeAgents = Array.from(this.agents.values())
            .filter((agent) => agent.getState().status === "busy").length;

        return (activeAgents / this.agents.size) * 100;
    }

    private startScalingMonitor(): void {
        setInterval(() => {
            this.checkIdleAgents();
            this.updateMetrics();
        }, 5000); // Check every 5 seconds
    }

    private async checkIdleAgents(): Promise<void> {
        for (const [id, agent] of this.agents) {
            if (
                agent.getIdleTime() > this.config.idleTimeout &&
                this.agents.size > this.config.minAgents
            ) {
                await this.removeAgent(id);
            }
        }
    }

    private startMetricsCollection(): void {
        setInterval(() => {
            this.updateMetrics();
        }, 1000); // Update metrics every second
    }

    private updateMetrics(): void {
        const activeAgents = Array.from(this.agents.values())
            .filter((agent) => agent.getState().status === "busy").length;

        this.metrics = {
            totalAgents: this.agents.size,
            activeAgents,
            idleAgents: this.agents.size - activeAgents,
            queuedTasks: this.taskQueue.length,
            averageResponseTime: this.calculateAverageResponseTime(),
            resourceUtilization: (activeAgents / this.agents.size) * 100,
        };
    }

    private calculateAverageResponseTime(): number {
        // Implement rolling average of task completion times
        return 0; // Placeholder
    }

    private async removeAgent(agentId: string): Promise<void> {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        // Clean up agent references
        this.agents.delete(agentId);
        this.metrics.totalAgents--;

        await this.eventBus.publish("agent:removed", {
            agentId,
        }, "agent-pool");
    }

    public getMetrics(): AgentPoolMetrics {
        return { ...this.metrics };
    }
}
