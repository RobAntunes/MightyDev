import React, { useState } from "react";
import { Sparkles, Send } from "lucide-react";

interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface NaturalLanguageInterfaceProps {
  onContextChange: (context: string) => void;
}

const NaturalLanguageInterface: React.FC<NaturalLanguageInterfaceProps> = ({
  onContextChange,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages([...messages, newMessage]);
    setInputValue("");
  };

  return (
    <div className="flex flex-col gap-4 p-4 w-full h-full justify-between">
      {/* Project Understanding Box - Fixed Height */}
      <div className="flex flex-col bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-800/50 p-4 h-[150px]">
        <h2 className="text-lg font-light text-zinc-300 mb-4">
          Project Understanding
        </h2>
        <div className="space-y-4">
          <div className="bg-zinc-800/50 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-lime-400" />
              <span className="text-sm font-light text-zinc-300">
                Current Focus
              </span>
            </div>
            <p className="text-sm text-zinc-400">
              I'm analyzing your project structure and goals to provide the most
              relevant assistance.
            </p>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <div className="flex flex-col bg-zinc-900/80 backdrop-blur-md rounded-lg border border-zinc-800/50">
        {/* Messages Area */}
        <div className="flex-1 h-full overflow-y-auto p-4 space-y-4 min-h-[450px]">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.sender === "user"
                    ? "bg-lime-500/20 text-lime-100"
                    : "bg-zinc-800/50 text-zinc-300"
                }`}
              >
                <p className="text-sm">{message.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-zinc-800/50"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-grow bg-zinc-800/50 rounded-lg px-4 py-2 text-sm text-zinc-300 
                        placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500"
              placeholder="Type your message..."
            />
            <button
              type="submit"
              className="p-2 bg-lime-500 hover:bg-lime-600 rounded-lg transition-colors duration-200"
              disabled={!inputValue.trim()}
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NaturalLanguageInterface;
