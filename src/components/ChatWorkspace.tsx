import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, RefreshCw, Eye, Code2, X } from 'lucide-react';

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
      await simulateAIResponse(userMessage);
    } catch (error) {
      console.error('Error processing message:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const simulateAIResponse = async (userMessage: Message) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // This is where we'd integrate with the actual AI service
    // For now, we'll simulate different types of responses based on keywords
    let response = '';
    let codeBlocks = [];
    
    if (userMessage.content.toLowerCase().includes('button')) {
      response = "I'll help you create a button component. Here's a React implementation:";
      codeBlocks.push({
        id: 'button-1',
        code: `interface ButtonProps {\n  children: React.ReactNode;\n  onClick?: () => void;\n  variant?: 'primary' | 'secondary';\n}\n\nconst Button: React.FC<ButtonProps> = ({ \n  children, \n  onClick, \n  variant = 'primary' \n}) => {\n  return (\n    <button\n      onClick={onClick}\n      className={\`px-4 py-2 rounded-lg transition-colors \${variant === 'primary' ? 'bg-lime-500 hover:bg-lime-600' : 'bg-zinc-700 hover:bg-zinc-600'}\`}\n    >\n      {children}\n    </button>\n  );\n};`,
        language: 'typescript'
      });
    } else if (userMessage.content.toLowerCase().includes('layout')) {
      response = "I'll help you create a flexible layout component. Here's a grid-based implementation:";
      codeBlocks.push({
        id: 'layout-1',
        code: `interface GridLayoutProps {\n  children: React.ReactNode;\n  columns?: number;\n  gap?: number;\n}\n\nconst GridLayout: React.FC<GridLayoutProps> = ({ \n  children, \n  columns = 2, \n  gap = 4 \n}) => {\n  return (\n    <div \n      className={\`grid grid-cols-\${columns} gap-\${gap}\`}\n    >\n      {children}\n    </div>\n  );\n};`,
        language: 'typescript'
      });
    } else {
      response = `I understand you want to ${userMessage.content.toLowerCase()}. I'll help you break this down into manageable steps.`;
      codeBlocks.push({
        id: 'sample-1',
        code: '// Initial implementation\nconsole.log("Starting implementation...");',
        language: 'typescript'
      });
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: response,
      role: 'assistant',
      timestamp: new Date(),
      codeBlocks
    };

    setMessages(prev => [...prev, assistantMessage]);
    
    // Update preview if applicable
    if (onPreviewUpdate) {
      setPreviewContent(assistantMessage.content);
      onPreviewUpdate(assistantMessage.content);
    }
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-900/80">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === 'user'
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
  );
};

export default ChatWorkspace;