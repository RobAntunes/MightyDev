// src/types/messages.ts

import { AIMessage, MessageContent } from "./ai";

/**
 * Generates a unique identifier for messages.
 */
export const generateUUID = (): string => {
    return crypto.randomUUID();
};

/**
 * Creates a user message.
 * @param content - The content of the user message.
 * @returns An AIMessage object representing the user message.
 */
export function createUserMessage(content: string): AIMessage {
    return {
        id: generateUUID(),
        role: "user",
        content: [{ type: "text", content }], // Changed to array for consistency
        timestamp: new Date().toISOString(),
        status: "complete",
    };
}

/**
 * Creates a pending assistant message.
 * @returns An AIMessage object representing a pending assistant message.
 */
export function createPendingAssistantMessage(): AIMessage {
    return {
        id: generateUUID(),
        role: "assistant",
        content: [{ type: "text", content: "Thinking..." }], // Changed to array
        timestamp: new Date().toISOString(),
        status: "pending",
    };
}

/**
 * Creates an assistant message.
 * @param content - The content of the assistant message. Can be a string or array of objects.
 * @param id - The ID to associate with this message (typically the pending message's ID).
 * @returns An AIMessage object representing the assistant message.
 */
export function createAssistantMessage(content: MessageContent, id: string): AIMessage {
    return {
        id, // Use the existing pending message ID
        role: "assistant",
        content: typeof content === "string" ? [{ type: "text", content }] : content,
        timestamp: new Date().toISOString(),
        status: "complete",
    };
}

/**
 * Creates an error message.
 * @param error - The error message content.
 * @param id - The ID to associate with this message (typically the pending message's ID).
 * @returns An AIMessage object representing the error message.
 */
export function createErrorMessage(error: string, id: string): AIMessage {
    return {
        id, // Use the existing pending message ID
        role: "assistant",
        content: [{ type: "error", content: error }],
        timestamp: new Date().toISOString(),
        status: "error",
    };
}