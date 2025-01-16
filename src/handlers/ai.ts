// src/handlers/ai.ts
import { eventSystem } from "../classes/events/EventSystem";
import { AnthropicService } from "../services/ai/Anthropic";
import { CompletionRequest } from "../types/ai";
import { EventPayload } from "../types/events";

export async function startAIRequestHandler() {
  // 1) If your AnthropicService constructor needs the eventBus, just call getEventBus():
  const bus = eventSystem.getEventBus();
  
  const anthropicService = new AnthropicService({
    eventBus: bus, "model": {
        model: "claude-3-5-sonnet-20241022",
        maxTokens: 1024,
        provider: "anthropic"
    }
  });
  await anthropicService.initialize();

  // 2) Subscribe to "ai:request"
  await bus.subscribe("ai:request", async (event: EventPayload<CompletionRequest>) => {
    const requestId = event.data.id;
    console.log(event)
    try {
      const response = await anthropicService.getCompletion(event.data);
      await bus.publish("ai:response", { requestId, response }, "anthropic-handler");
    } catch (error: any) {
      await bus.publish("ai:error", { requestId, error: error.message }, "anthropic-handler");
    }
  });
}