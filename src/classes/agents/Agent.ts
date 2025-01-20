import { IAIAgent, AIAgentMetadata, AIAgentState, AIAgentTask, AIAgentResult, AIAgentStateChangeEvent } from "@/types/agents/base";
import { EventBusAdapter } from "@/types/events";
import { Message } from "@/types/messages";

export abstract class AIAgent implements IAIAgent {
    public readonly metadata: AIAgentMetadata;
    protected state: AIAgentState;
    protected eventBus: EventBusAdapter;

    constructor(metadata: AIAgentMetadata, eventBus: EventBusAdapter) {
        this.metadata = metadata;
        this.eventBus = eventBus;
        this.state = {
            status: 'idle',
            currentTasks: [],
            lastActivity: Date.now()
        };
    }

    public abstract processTask(task: AIAgentTask): Promise<AIAgentResult>;
    public abstract handleSystemMessage(message: Message): Promise<void>;

    public getState(): AIAgentState {
        return { ...this.state };
    }

    protected async updateState(update: Partial<AIAgentState>): Promise<void> {
        this.state = { ...this.state, ...update };
        await this.eventBus.publish(
            'agent:stateChanged',
            {
                agentId: this.metadata.id,
                state: this.state
            } as AIAgentStateChangeEvent,
            'agent'
        );
    }
}