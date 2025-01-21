// services/storage/chatStorage.ts
import { StorageService } from "../services/db/rocksdb";
import { Chat } from "../types/chat";
import { SystemInitializer } from "@/services/init";
import { Auth0ContextInterface } from "@auth0/auth0-react";

export const CHAT_KEYS = {
  CHAT_PREFIX: "chat:", // Prefix for individual chats
  CHAT_INDEX: "chatIndex", // Stores list of all chat IDs
  ACTIVE_CHAT: "activeChat", // Stores current active chat ID
} as const;

// Helper to get a chat's storage key
const getChatKey = (chatId: string) => `${CHAT_KEYS.CHAT_PREFIX}${chatId}`;

// Store a single chat
export async function storeChat(
  chat: Chat,
  storage: StorageService,
): Promise<void> {
  await storage.storeJson(getChatKey(chat.id), chat);

  // Update chat index
  const chatIndex = await getChatIndex(storage);
  if (!chatIndex.includes(chat.id)) {
    chatIndex.push(chat.id);
    await storage.storeJson(
      CHAT_KEYS.CHAT_INDEX,
      chatIndex,
    );
  }
}

// Load a single chat
export async function loadChat(
  chatId: string,
  storage: StorageService,
): Promise<Chat | null> {
  return await storage.getJson<Chat>(getChatKey(chatId));
}

// Delete a single chat
export async function deleteChat(
  chatId: string,
  storage: StorageService,
): Promise<void> {
  await storage.delete(getChatKey(chatId));

  // Update chat index
  const chatIndex = await getChatIndex(storage);
  const updatedIndex = chatIndex.filter((id) => id !== chatId);
  await storage.storeJson(
    CHAT_KEYS.CHAT_INDEX,
    updatedIndex,
  );
}

// Get list of all chat IDs
export async function getChatIndex(storage: StorageService): Promise<string[]> {
  return await storage.getJson<string[]>(
    CHAT_KEYS.CHAT_INDEX,
  ) ||
    [];
}

// Load all chats (for initial load)
export async function loadAllChats(
  storage: StorageService,
): Promise<Record<string, Chat>> {
  const chatIndex = await getChatIndex(storage);
  const chats: Record<string, Chat> = {};

  await Promise.all(
    chatIndex.map(async (chatId) => {
      const chat = await loadChat(chatId, storage);
      if (chat) {
        chats[chatId] = chat;
      }
    }),
  );

  return chats;
}

// Set active chat
export async function setActiveChat(
  chatId: string | null,
  storage: StorageService,
): Promise<void> {
  if (chatId) {
    await storage.store(CHAT_KEYS.ACTIVE_CHAT, chatId);
  } else {
    await storage.delete(CHAT_KEYS.ACTIVE_CHAT);
  }
}

// Get active chat ID
export async function getActiveChat(
  storage: StorageService,
): Promise<string | null> {
  return await storage.get(CHAT_KEYS.ACTIVE_CHAT);
}
