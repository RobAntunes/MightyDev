import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, RefreshCw, Eye, Code2, X, TerminalIcon } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  codeBlocks?: Array<{
    id: string;
    code: string;
    language: string;
  }>;
}

interface ChatWorkspaceProps {
  onPreviewUpdate?: (content: string) => void;
  onCodeUpdate?: (content: string) => void;
  className?: string;
}

const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  onPreviewUpdate,
  onCodeUpdate,
  className = ''
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Here we'd integrate with the AI service
      // For now, we'll simulate a response
      // TODO: Replace with actual AI service integration
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      setIsProcessing(false);
    }
  };





  return (
    <div className={`justify-stretch flex flex-col h-full ${className}`}>
      {/* Chat Messages */}
      <div className="flex-1 h-full overflow-y-auto p-4 space-y-4 bg-zinc-900/80">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${message.role === 'user'
                  ? 'bg-lime-500/20 text-lime-100'
                  : 'bg-zinc-800/50 text-zinc-300'
                }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {message.codeBlocks?.map((block) => (
                <div key={block.id} className="mt-3 bg-zinc-900/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">{block.language}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onCodeUpdate?.(block.code)}
                        className="p-1 hover:bg-zinc-800 rounded"
                        title="Open in Editor"
                      >
                        <Code2 className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                  <pre className="text-sm overflow-x-auto">
                    <code>{block.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div>
        <form onSubmit={handleSendMessage} className="p-4 bg-zinc-900/90 border-t border-zinc-800/50">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isProcessing}
              className="flex-grow bg-zinc-800/50 rounded-lg px-4 py-2 text-sm text-zinc-300 
            placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-lime-500
            disabled:opacity-50"
              placeholder={isProcessing ? 'Processing...' : 'Describe what you want to build...'}
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
    </div>
  );
};

export default ChatWorkspace;