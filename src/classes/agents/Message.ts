// types/messages.ts

export type MessageRole = "user" | "assistant" | "system";

export type MessageStatus = "pending" | "complete" | "error";

export interface MessageContent {
  type: "text" | "code" | "error";
  content: string;
  language?: string; // For code blocks
  title?: string; // For code blocks or errors
}

export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent[];
  timestamp: Date;
  status: MessageStatus;
  metadata?: {
    processingTime?: number;
    model?: string;
    tokens?: {
      input: number;
      output: number;
      total: number;
    };
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

export interface ChatRequest {
  messages: string[];
  maxTokens?: number;
  model?: string;
}

export interface ChatResponse {
  message: Message;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Helper functions
export function createUserMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content: [{
      type: "text",
      content,
    }],
    timestamp: new Date(),
    status: "complete",
  };
}

export function createPendingAssistantMessage(): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: [{
      type: "text",
      content: "Thinking...",
    }],
    timestamp: new Date(),
    status: "pending",
  };
}

export function createErrorMessage(error: Error | string): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: [{
      type: "error",
      content: typeof error === "string" ? error : error.message,
    }],
    timestamp: new Date(),
    status: "error",
    metadata: {
      error: {
        code: "PROCESSING_ERROR",
        message: typeof error === "string" ? error : error.message,
      },
    },
  };
}

export function createAssistantMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content: [{
      type: "text",
      content,
    }],
    timestamp: new Date(),
    status: "complete",
  };
}

export function addCodeBlockToMessage(
  message: Message,
  code: string,
  language: string,
  title?: string,
): Message {
  return {
    ...message,
    content: [
      ...message.content,
      {
        type: "code",
        content: code,
        language,
        title,
      },
    ],
  };
}

// Type guards
export function isErrorResponse(
  response: ChatResponse | ErrorResponse,
): response is ErrorResponse {
  return "error" in response;
}

export function isCodeBlock(content: MessageContent): boolean {
  return content.type === "code";
}
