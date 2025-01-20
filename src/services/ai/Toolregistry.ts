import { eventSystem } from "../../classes/events/manager";
import { EventBusAdapter } from "@/types/events";
import { AITool, ToolMetadata, ToolCapability } from "../../types/tools/base";

// Tool registry for managing multiple AI tools
export class AIToolRegistry {
    private tools = new Map<string, AITool>();
    private eventBus: EventBusAdapter;

    constructor() {
        this.eventBus = eventSystem.getEventBus();
    }

    registerTool(name: string, tool: AITool): void {
        this.tools.set(name, tool);
        
        // Publish tool registration event
        this.eventBus.publish(
            'tools:registered',
            {
                name,
                metadata: tool.metadata
            },
            'tool-registry'
        );
    }

    getTool<T extends AITool>(name: string): T {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return tool as T;
    }

    listTools(): ToolMetadata[] {
        return Array.from(this.tools.values()).map(tool => tool.metadata);
    }

    findToolsByCapability(capability: ToolCapability): AITool[] {
        return Array.from(this.tools.values())
            .filter(tool => tool.metadata.capabilities.includes(capability));
    }
}