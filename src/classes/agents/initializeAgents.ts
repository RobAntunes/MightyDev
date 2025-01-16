import { EventBus } from '../events/eventBus';
import { ArchitectClient } from '../agents/architect';
import { OrchestratorAgent } from './orchestrator';

interface AgentSystemConfig {
    googleProjectId: string;
    googleLocation: string;
}

export class AgentSystem {
    public eventBus: EventBus;
    private architect: ArchitectAgent;
    private orchestrator: OrchestratorAgent;

    constructor(config: AgentSystemConfig) {
        // Initialize event bus first as other components depend on it
        this.eventBus = new EventBus({ debug: process.env.NODE_ENV === 'development' });

        // Initialize agents
        this.architect = new ArchitectAgent(
            config.googleProjectId,
            config.googleLocation,
            this.eventBus
        );

        // Initialize orchestrator last as it needs to coordinate all agents
        this.orchestrator = new OrchestratorAgent(this.eventBus);
    }

    public getEventBus(): EventBus {
        return this.eventBus;
    }

    public getArchitect(): ArchitectAgent {
        return this.architect;
    }

    public getOrchestrator(): OrchestratorAgent {
        return this.orchestrator;
    }
}

// Initialize the agent system at the app level
let agentSystem: AgentSystem | null = null;

export const initializeAgentSystem = (config: AgentSystemConfig): AgentSystem => {
    if (!agentSystem) {
        agentSystem = new AgentSystem(config);
    }
    return agentSystem;
};

export const getAgentSystem = (): AgentSystem => {
    if (!agentSystem) {
        throw new Error('Agent system not initialized. Call initializeAgentSystem first.');
    }
    return agentSystem;
};