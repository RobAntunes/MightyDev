import { Message } from './messages';

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata?: {
    description?: string;
    tags?: string[];
    context?: Record<string, unknown>;
  };
}

export interface ChatState {
  chats: Record<string, Chat>;
  activeChat: string | null;
}

export const STORAGE_KEYS = {
  CHATS: 'chats',
  ACTIVE_CHAT: 'activeChat',
} as const;