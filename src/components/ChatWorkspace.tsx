import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, RefreshCw, Send, Sparkles } from "lucide-react";
import {
  createErrorMessage,
  createPendingAssistantMessage,
  createUserMessage,
  createAssistantMessage,
  Message,
  MessageContent,
} from "../types/messages";
import { eventSystem } from "../classes/events/EventSystem";
import { EventPayload } from "../types/events";
import { AIEventMap } from "../types/ai";

interface ChatWorkspaceProps {
  className?: string;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ className = "" }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Optional: Add a limit to prevent the context from growing too large
  const MAX_MESSAGES = 20;
  
  // Clean up old messages when they exceed the limit
  useEffect(() => {
    if (messages.length > MAX_MESSAGES) {
      setMessages(prev => prev.slice(-MAX_MESSAGES));
    }
  }, [messages]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const subscriptionsRef = useRef<{ response?: string; error?: string }>({});

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      cleanupSubscriptions();
    };
  }, []);

  const cleanupSubscriptions = async () => {
    try {
      if (subscriptionsRef.current.response) {
        await eventSystem.getEventBus().unsubscribe(subscriptionsRef.current.response);
      }
      if (subscriptionsRef.current.error) {
        await eventSystem.getEventBus().unsubscribe(subscriptionsRef.current.error);
      }
      subscriptionsRef.current = {};
    } catch (error) {
      console.error("Error cleaning up subscriptions:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage = createUserMessage(inputValue);
    const pendingMessage = createPendingAssistantMessage();
    setMessages((prev) => [...prev, userMessage, pendingMessage]);
    setInputValue("");
    setIsProcessing(true);

    const requestId = crypto.randomUUID();

    try {
      await cleanupSubscriptions();

      // Set up response handler
      const responseSubscription = await eventSystem.getEventBus().subscribe(
        "ai:response",
        async (event: EventPayload<{ text: string }>) => {
          const assistantMessage = createAssistantMessage(event.data.text);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === pendingMessage.id ? assistantMessage : msg
            )
          );
          setIsProcessing(false);
        }
      );

      // Set up error handler
      const errorSubscription = await eventSystem.getEventBus().subscribe(
        "ai:error",
        async (event: EventPayload<{ error: string }>) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === pendingMessage.id
                ? createErrorMessage(event.data.error)
                : msg
            )
          );
          setIsProcessing(false);
        }
      );

      subscriptionsRef.current = {
        response: responseSubscription,
        error: errorSubscription,
      };

      // Construct the message payload with conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content[0].content,
      }));
      
      // Add the new user message
      conversationHistory.push({
        role: "user",
        content: userMessage.content[0].content,
      });

      const payload = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: conversationHistory,
      };

      await eventSystem.getEventBus().publish(
        "ai:request",
        payload,
        "chat-workspace"
      );
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === pendingMessage.id
            ? createErrorMessage(error instanceof Error ? error.message : "Unknown error")
            : msg
        )
      );
      setIsProcessing(false);
      await cleanupSubscriptions();
    }
  };

  const renderMessageContent = (content: MessageContent) => {
    switch (content.type) {
      case "text":
        return (
          <div className="text-sm whitespace-pre-wrap">{content.content}</div>
        );
      case "code":
        return (
          <div className="mt-2 font-mono text-sm">
            {content.title && (
              <div className="text-xs text-zinc-500 mb-1">{content.title}</div>
            )}
            <pre className="bg-zinc-900/50 p-3 rounded-md overflow-x-auto">
              <code className={`language-${content.language || "plaintext"}`}>
                {content.content}
              </code>
            </pre>
          </div>
        );
      case "error":
        return (
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-4 h-4" />
            <span>{content.content}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex flex-col h-full bg-zinc-900 ${className}`}>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            } mb-4`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg ${
                message.role === "user"
                  ? "bg-lime-500/20 text-lime-100"
                  : message.status === "error"
                  ? "bg-red-500/20 text-red-200"
                  : "bg-zinc-800/50 text-zinc-300"
              }`}
            >
              {message.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-lime-400 animate-pulse" />
                  <span>Processing...</span>
                </div>
              ) : (
                message.content.map((content, index) => (
                  <div key={`${message.id}-content-${index}`}>
                    {renderMessageContent(content)}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isProcessing}
            className="flex-grow bg-zinc-800/50 rounded-lg px-4 py-2 text-sm 
                     text-zinc-300 placeholder-zinc-500 focus:outline-none 
                     focus:ring-1 focus:ring-lime-500 disabled:opacity-50"
            placeholder={isProcessing ? "Processing..." : "Type your message..."}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="p-2 bg-lime-500 hover:bg-lime-600 disabled:bg-zinc-700 
                     rounded-lg transition-colors duration-200"
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatWorkspace;