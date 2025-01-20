import { AIAgentRole, IAIAgent } from "@/types/agents/base";
import { EventBusAdapter } from "@/types/events";
import { CodeAnalysisAgent } from "./CodeAnalysis";
import { OrchestratorAgent } from "./Orchestrator";

export class AIAgentFactory {
    private eventBus: EventBusAdapter;

    constructor(eventBus: EventBusAdapter) {
        this.eventBus = eventBus;
    }

    createAgent(role: AIAgentRole): IAIAgent {
        switch (role) {
            case 'orchestrator':
                return new OrchestratorAgent(this.eventBus);
            case 'codeAnalysis':
                return new CodeAnalysisAgent(this.eventBus);
            // Add other agent types as needed
            default:
                throw new Error(`Unknown agent role: ${role}`);
        }
    }
}