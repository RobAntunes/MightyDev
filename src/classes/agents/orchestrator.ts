import { Event , EventBus } from '../events/eventBus';

// Types
export type AgentType = 'architect' | 'programmer' | 'reviewer' | 'qa' | 'ui';

export interface AgentTask {
  id: string;
  type: string;
  priority: number;
  input: any;
  source: AgentType;
  target: AgentType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentState {
  type: AgentType;
  busy: boolean;
  currentTask?: string;
  lastActive: number;
}

export interface ProjectContext {
  goals: string[];
  constraints: string[];
  currentFiles: string[];
  agentStates: Map<AgentType, AgentState>;
  taskHistory: AgentTask[];
}

export class OrchestratorAgent {
  private eventBus: EventBus;
  private context: ProjectContext;
  private taskQueue: AgentTask[];
  private activeAgents: Map<AgentType, AgentState>;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.taskQueue = [];
    this.activeAgents = new Map();
    this.context = {
      goals: [],
      constraints: [],
      currentFiles: [],
      agentStates: new Map(),
      taskHistory: []
    };

    this.initializeAgents();
    this.setupEventListeners();
  }

  private initializeAgents() {
    const agents: AgentType[] = ['architect', 'programmer', 'reviewer', 'qa', 'ui'];
    agents.forEach(type => {
      this.activeAgents.set(type, {
        type,
        busy: false,
        lastActive: Date.now()
      });
    });
  }

  private setupEventListeners() {
    // Listen for user input from chat
    this.eventBus.subscribe<{ messageId: string; content: string }>('chat:message', 
      (event: Event) => this.handleUserInput(event.payload));

    // Listen for agent task completion
    this.eventBus.subscribe<{ taskId: string; result: any }>('agent:task:completed',
      (event: Event) => this.handleTaskCompletion(event.payload));

    // Listen for agent task failure
    this.eventBus.subscribe<{ taskId: string; error: string }>('agent:task:failed',
      (event: Event) => this.handleTaskFailure(event.payload));

    // Listen for context updates
    this.eventBus.subscribe<Partial<ProjectContext>>('context:updated',
      (event: Event) => this.updateContext(event.payload));
  }

  private async handleUserInput(payload: { messageId: string; content: string }) {
    const input = payload.content;
    
    // Create initial architect task to analyze user input
    const task: AgentTask = {
      id: crypto.randomUUID(),
      type: 'analyze_input',
      priority: 1,
      input,
      source: 'architect',
      target: 'architect',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.taskQueue.push(task);
    await this.processTaskQueue();
  }

  private async handleTaskCompletion(event: { taskId: string, result: any }) {
    const { taskId, result } = event;
    const task = this.findTask(taskId);
    if (!task) return;

    task.status = 'completed';
    task.result = result;
    task.updatedAt = Date.now();

    // Free up the agent
    const agent = this.activeAgents.get(task.target);
    if (agent) {
      agent.busy = false;
      agent.currentTask = undefined;
      agent.lastActive = Date.now();
    }

    // Create follow-up tasks based on the result
    const followUpTasks = this.createFollowUpTasks(task);
    this.taskQueue.push(...followUpTasks);

    // Update context
    this.updateTaskHistory(task);

    // Process next tasks
    await this.processTaskQueue();
  }

  private async handleTaskFailure(event: { taskId: string, error: string }) {
    const { taskId, error } = event;
    const task = this.findTask(taskId);
    if (!task) return;

    task.status = 'failed';
    task.error = error;
    task.updatedAt = Date.now();

    // Free up the agent
    const agent = this.activeAgents.get(task.target);
    if (agent) {
      agent.busy = false;
      agent.currentTask = undefined;
      agent.lastActive = Date.now();
    }

    // Create recovery tasks if needed
    const recoveryTasks = this.createRecoveryTasks(task);
    this.taskQueue.push(...recoveryTasks);

    // Update context
    this.updateTaskHistory(task);

    // Process next tasks
    await this.processTaskQueue();
  }

  private findTask(taskId: string): AgentTask | undefined {
    return this.taskQueue.find(t => t.id === taskId);
  }

  private createFollowUpTasks(completedTask: AgentTask): AgentTask[] {
    const followUpTasks: AgentTask[] = [];

    switch (completedTask.type) {
      case 'analyze_input':
        // Architect has analyzed, create tasks for implementation
        if (completedTask.result.needsImplementation) {
          followUpTasks.push({
            id: crypto.randomUUID(),
            type: 'implement_feature',
            priority: 2,
            input: completedTask.result.implementation,
            source: 'architect',
            target: 'programmer',
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
        break;

      case 'implement_feature':
        // Code was implemented, create review task
        followUpTasks.push({
          id: crypto.randomUUID(),
          type: 'review_code',
          priority: 2,
          input: completedTask.result,
          source: 'programmer',
          target: 'reviewer',
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        break;

      // Add more cases as needed
    }

    return followUpTasks;
  }

  private createRecoveryTasks(failedTask: AgentTask): AgentTask[] {
    // Create recovery tasks based on the failure type
    const recoveryTasks: AgentTask[] = [];
    
    // If it's a critical task, create a high-priority retry
    if (failedTask.priority === 1) {
      recoveryTasks.push({
        ...failedTask,
        id: crypto.randomUUID(),
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }

    return recoveryTasks;
  }

  private updateContext(update: Partial<ProjectContext>) {
    this.context = {
      ...this.context,
      ...update
    };
  }

  private updateTaskHistory(task: AgentTask) {
    this.context.taskHistory.push(task);
    // Keep only last 100 tasks for memory efficiency
    if (this.context.taskHistory.length > 100) {
      this.context.taskHistory.shift();
    }
  }

  private async processTaskQueue() {
    // Sort tasks by priority
    this.taskQueue.sort((a, b) => a.priority - b.priority);

    // Process pending tasks
    for (const task of this.taskQueue) {
      if (task.status !== 'pending') continue;

      const targetAgent = this.activeAgents.get(task.target);
      if (!targetAgent || targetAgent.busy) continue;

      // Assign task to agent
      targetAgent.busy = true;
      targetAgent.currentTask = task.id;
      task.status = 'processing';

      // Publish task to agent
      this.eventBus.publish(`agent:${task.target}:task`, task, 'orchestrator');
    }
  }

  // Public methods for system interaction
  public addTask(task: Omit<AgentTask, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    const newTask: AgentTask = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.taskQueue.push(newTask);
    this.processTaskQueue();
  }

  public getAgentState(type: AgentType): AgentState | undefined {
    return this.activeAgents.get(type);
  }

  public getContext(): ProjectContext {
    return { ...this.context };
  }
}