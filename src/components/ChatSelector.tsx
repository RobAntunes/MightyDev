import React, { useState } from 'react';
import { MessageSquarePlus, Settings, Trash2 } from 'lucide-react';
import { Chat } from '@/types/chat';

interface ChatSelectorProps {
  chats: Record<string, Chat>;
  activeChat: string | null;
  onSelectChat: (id: string) => void;
  onCreateChat: () => void;
  onDeleteChat: (id: string) => void;
}

export default function ChatSelector({
  chats,
  activeChat,
  onSelectChat,
  onCreateChat,
  onDeleteChat
}: ChatSelectorProps) {
  const [isHovered, setIsHovered] = useState<string | null>(null);

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border-r border-zinc-800/50 w-64 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <button
          onClick={onCreateChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-lime-500 hover:bg-lime-600 rounded-lg text-white transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span className="text-sm">New Chat</span>
        </button>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {Object.values(chats).map((chat) => (
          <div
            key={chat.id}
            className={`relative p-4 cursor-pointer transition-all duration-200 ${
              chat.id === activeChat
                ? 'bg-lime-500/20 text-lime-100'
                : 'hover:bg-zinc-800/50 text-zinc-300'
            }`}
            onClick={() => onSelectChat(chat.id)}
            onMouseEnter={() => setIsHovered(chat.id)}
            onMouseLeave={() => setIsHovered(null)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium truncate">{chat.title}</h3>
                <p className="text-xs text-zinc-500 truncate">
                  {chat.messages.length} messages
                </p>
              </div>

              {/* Action buttons - only show on hover or active */}
              {(isHovered === chat.id || chat.id === activeChat) && (
                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="p-1 hover:bg-red-500/20 rounded transition-colors text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Settings Footer */}
      <div className="p-4 border-t border-zinc-800/50">
        <button className="w-full flex items-center gap-2 px-4 py-2 hover:bg-zinc-800/50 rounded-lg text-zinc-400 transition-colors">
          <Settings className="w-4 h-4" />
          <span className="text-sm">Settings</span>
        </button>
      </div>
    </div>
  );
}