import { IAIAgent, AIAgentTask, AIAgentStateChangeEvent, AIAgentResult, AIAgentState } from "@/types/agents/base";
import { EventBusAdapter, EventPayload } from "@/types/events";
import { Message } from "@/types/messages";
import { AIAgent } from "./Agent";

export class OrchestratorAgent extends AIAgent {
    private agents: Map<string, IAIAgent>;
    private taskQueue: AIAgentTask[];

    constructor(eventBus: EventBusAdapter) {
        super(
            {
                id: 'orchestrator',
                name: 'System Orchestrator',
                role: 'orchestrator',
                version: '1.0',
                capabilities: [
                    {
                        type: 'taskDistribution',
                        description: 'Distributes tasks to specialized agents'
                    },
                    {
                        type: 'agentCoordination',
                        description: 'Coordinates multi-agent tasks'
                    }
                ],
                maxConcurrentTasks: 10
            },
            eventBus
        );

        this.agents = new Map();
        this.taskQueue = [];

        this.initializeEventListeners();
    }

    private async initializeEventListeners(): Promise<void> {
        // Listen for new tasks
        await this.eventBus.subscribe('task:created', async (event: EventPayload<AIAgentTask>) => {
            await this.enqueueTask(event.data);
        });

        // Listen for agent state changes
        await this.eventBus.subscribe('agent:stateChanged', async (event: EventPayload<AIAgentStateChangeEvent>) => {
            const { agentId, state } = event.data;
            await this.handleAgentStateChange(agentId, state);
        });
    }

    private async enqueueTask(task: AIAgentTask): Promise<void> {
        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => b.priority - a.priority);
        await this.processQueue();
    }

    private async processQueue(): Promise<void> {
        if (this.taskQueue.length === 0) return;

        for (const task of this.taskQueue) {
            const assignedAgent = await this.findAvailableAgent(task);
            if (assignedAgent) {
                this.taskQueue = this.taskQueue.filter(t => t.id !== task.id);
                await assignedAgent.processTask(task);
            }
        }
    }

    private async findAvailableAgent(task: AIAgentTask): Promise<IAIAgent | null> {
        for (const agent of this.agents.values()) {
            const state = agent.getState();
            if (
                state.status === 'idle' &&
                state.currentTasks.length < agent.metadata.maxConcurrentTasks &&
                this.canHandleTask(agent, task)
            ) {
                return agent;
            }
        }
        return null;
    }

    private canHandleTask(agent: IAIAgent, task: AIAgentTask): boolean {
        return agent.metadata.capabilities.some(cap => cap.type === task.type);
    }

    public registerAgent(agent: IAIAgent): void {
        this.agents.set(agent.metadata.id, agent);
    }

    public async processTask(task: AIAgentTask): Promise<AIAgentResult> {
        // Orchestrator's own task processing logic
        return {
            taskId: task.id,
            success: true,
            metrics: {
                startTime: Date.now(),
                endTime: Date.now()
            }
        };
    }

    public async handleSystemMessage(message: Message): Promise<void> {
        // Process system messages and potentially create new tasks
        const task = await this.createTaskFromMessage(message);
        if (task) {
            await this.enqueueTask(task);
        }
    }

    private async createTaskFromMessage(message: Message): Promise<AIAgentTask | null> {
        // Transform system messages into tasks based on content analysis
        // This is where we'll integrate with the foundation model
        return null;
    }

    private async handleAgentStateChange(agentId: string, state: AIAgentState): Promise<void> {
        if (state.status === 'idle') {
            await this.processQueue();
        }
    }
}