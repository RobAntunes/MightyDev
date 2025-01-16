import React, { useEffect, useRef, useState } from "react";
import { Message, MessageContent } from "../types/messages";
import { AlertTriangle, RefreshCw, Send, Sparkles } from "lucide-react";

interface ChatInterfaceProps {
  messages?: Message[];
  onSendMessage: (content: string) => Promise<void>;
  isProcessing: boolean;
}

export default function ChatInterface({
  messages,
  onSendMessage,
  isProcessing,
}: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    await onSendMessage(inputValue);
    setInputValue("");
  };

  const renderMessageContent = (content: MessageContent) => {
    switch (content.type) {
      case "text":
        return (
          <div className="text-sm whitespace-pre-wrap">
            {content.content}
          </div>
        );
      case "code":
        return (
          <div className="mt-2 font-mono text-sm">
            {content.title && (
              <div className="text-xs text-zinc-500 mb-1">
                {content.title}
              </div>
            )}
            <pre className="bg-zinc-900/50 p-3 rounded-md overflow-x-auto">
              <code className={`language-${content.language || 'plaintext'}`}>
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
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Messages Area */}
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
              {message.status === "pending"
                ? (
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-lime-400 animate-pulse" />
                    <span>Processing...</span>
                  </div>
                )
                : (
                  message.content.map((
                    content: MessageContent,
                    index: number,
                  ) => (
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

      {/* Input Area */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-zinc-800/50"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isProcessing}
            className="flex-grow bg-zinc-800/50 rounded-lg px-4 py-2 text-sm 
                     text-zinc-300 placeholder-zinc-500 focus:outline-none 
                     focus:ring-1 focus:ring-lime-500 disabled:opacity-50"
            placeholder={isProcessing
              ? "Processing..."
              : "Type your message..."}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isProcessing}
            className="p-2 bg-lime-500 hover:bg-lime-600 disabled:bg-zinc-700 
                     rounded-lg transition-colors duration-200"
          >
            {isProcessing
              ? <RefreshCw className="w-4 h-4 text-white animate-spin" />
              : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
      </form>
    </div>
  );
}
