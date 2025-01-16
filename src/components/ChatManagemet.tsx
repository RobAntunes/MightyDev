// types/chat.ts

import { Chat } from '@/types/chat';
import { Message } from '../types/messages';



// Storage keys for persistence
export const STORAGE_KEYS = {
  CHATS: 'chats',
  ACTIVE_CHAT: 'activeChat',
} as const;

// Helper functions for chat management
export function createNewChat(title: string): Chat {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
}