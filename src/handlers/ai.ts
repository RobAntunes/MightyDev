// src/handlers/ai.ts
import { AnthropicService } from "../services/ai/Anthropic";
import { AIRequestPayload } from "../types/ai";
import {} from "../types/events";
import { eventSystem } from "../classes/events/manager";
import { Auth0ContextInterface } from "@auth0/auth0-react";

export async function startAIRequestHandler(auth0: Auth0ContextInterface) {
  const anthropicService = new AnthropicService({
    eventBus: eventSystem.getEventBus(),
    model: {
      model: "claude-3-5-sonnet-20241022",
      maxTokens: 1024,
      provider: "anthropic",
    },
  }, auth0);

  await anthropicService.initialize();

  // Subscribe to "ai:request"
  await eventSystem.getEventBus().subscribe(
    "ai:request",
    async (event: AIRequestPayload) => {
      console.log("Received AI request event:", event);
      try {
        const response = await anthropicService.getCompletion(event);
        await eventSystem.getEventBus().publish("ai:response", {
          id: response.id,
          text: response.text,
          model: response.model,
          usage: response.usage,
        }, "anthropic-handler");
      } catch (error: any) {
        console.error("Error handling AI request:", error);
        await eventSystem.getEventBus().publish("ai:error", {
          id: event.id, // Include request ID for mapping
          error: error.message,
        }, "anthropic-handler");
      }
    },
  );
}
