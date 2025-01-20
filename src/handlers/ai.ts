// src/handlers/ai.ts
import { AnthropicService } from "../services/ai/Anthropic";
import { CompletionRequest } from "../types/ai";
import { EventPayload } from "../types/events";
import { eventSystem } from "../classes/events/manager";

export async function startAIRequestHandler() {
  const anthropicService = new AnthropicService({
    eventBus: eventSystem.getEventBus(),
    "model": {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1024,
      provider: "anthropic",
    },
  });
  await anthropicService.initialize();

  // 2) Subscribe to "ai:request"
  await eventSystem.getEventBus().subscribe(
    "ai:request",
    async (event: EventPayload<CompletionRequest>) => {
      const requestId = event.data.id;
      console.log(event);
      try {
        const response = await anthropicService.getCompletion(event.data);
        await eventSystem.getEventBus().publish("ai:response", {
          requestId,
          response,
        }, "anthropic-handler");
      } catch (error: any) {
        await eventSystem.getEventBus().publish("ai:error", {
          requestId,
          error: error.message,
        }, "anthropic-handler");
      }
    },
  );
}
