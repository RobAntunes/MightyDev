// services/storage/chatStorage.ts
import { Chat } from "../types/chat";
import { Storage } from "../services/db/rocksdb";

export const CHAT_KEYS = {
  CHAT_PREFIX: "chat:", // Prefix for individual chats
  CHAT_INDEX: "chatIndex", // Stores list of all chat IDs
  ACTIVE_CHAT: "activeChat", // Stores current active chat ID
} as const;

// Helper to get a chat's storage key
const getChatKey = (chatId: string) => `${CHAT_KEYS.CHAT_PREFIX}${chatId}`;

// Store a single chat
export async function storeChat(chat: Chat): Promise<void> {
  await Storage.getDefault().storeJson(getChatKey(chat.id), chat);

  // Update chat index
  const chatIndex = await getChatIndex();
  if (!chatIndex.includes(chat.id)) {
    chatIndex.push(chat.id);
    await Storage.getDefault().storeJson(CHAT_KEYS.CHAT_INDEX, chatIndex);
  }
}

// Load a single chat
export async function loadChat(chatId: string): Promise<Chat | null> {
  return await Storage.getDefault().getJson<Chat>(getChatKey(chatId));
}

// Delete a single chat
export async function deleteChat(chatId: string): Promise<void> {
  await Storage.getDefault().delete(getChatKey(chatId));

  // Update chat index
  const chatIndex = await getChatIndex();
  const updatedIndex = chatIndex.filter((id) => id !== chatId);
  await Storage.getDefault().storeJson(CHAT_KEYS.CHAT_INDEX, updatedIndex);
}

// Get list of all chat IDs
export async function getChatIndex(): Promise<string[]> {
  return await Storage.getDefault().getJson<string[]>(CHAT_KEYS.CHAT_INDEX) ||
    [];
}

// Load all chats (for initial load)
export async function loadAllChats(): Promise<Record<string, Chat>> {
  const chatIndex = await getChatIndex();
  const chats: Record<string, Chat> = {};

  await Promise.all(
    chatIndex.map(async (chatId) => {
      const chat = await loadChat(chatId);
      if (chat) {
        chats[chatId] = chat;
      }
    }),
  );

  return chats;
}

// Set active chat
export async function setActiveChat(chatId: string | null): Promise<void> {
  if (chatId) {
    await Storage.getDefault().store(CHAT_KEYS.ACTIVE_CHAT, chatId);
  } else {
    await Storage.getDefault().delete(CHAT_KEYS.ACTIVE_CHAT);
  }
}

// Get active chat ID
export async function getActiveChat(): Promise<string | null> {
  return await Storage.getDefault().get(CHAT_KEYS.ACTIVE_CHAT);
}
