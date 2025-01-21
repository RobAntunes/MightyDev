// src/hooks/useChatStorage.ts

import { useCallback, useContext, useEffect, useState } from "react";
import { Chat } from "../types/chat";
import {
  deleteChat as deleteChatFromStorage,
  getActiveChat as getActiveChatFromStorage,
  loadAllChats as loadAllChatsFromStorage,
  loadChat as loadChatFromStorage, // Import and alias loadChat
  setActiveChat as setActiveChatInStorage,
  storeChat as storeChatInStorage,
} from "../lib/rocksdb"; // Correct path
import { StorageCtx } from "../main";


export const useChatStorage = () => {
  const storageService = useContext(StorageCtx);

  const storeChat = useCallback(async (chat: Chat) => {
    if (!storageService) throw new Error("Storage service is not initialized");
    await storeChatInStorage(chat, storageService);
  }, [storageService]);

  const loadChat = useCallback(async (chatId: string): Promise<Chat | null> => {
    if (!storageService) throw new Error("Storage service is not initialized");
    return await loadChatFromStorage(chatId, storageService); // Use the correctly imported function
  }, [storageService]);

  const loadAllChats = useCallback(async (): Promise<Record<string, Chat>> => {
    if (!storageService) throw new Error("Storage service is not initialized");
    return await loadAllChatsFromStorage(storageService); // Use the correctly imported function
  }, [storageService]);

  const deleteChat = useCallback(async (chatId: string) => {
    if (!storageService) throw new Error("Storage service is not initialized");
    await deleteChatFromStorage(chatId, storageService);
  }, [storageService]);

  const setActiveChat = useCallback(async (chatId: string | null) => {
    if (!storageService) throw new Error("Storage service is not initialized");
    await setActiveChatInStorage(chatId, storageService);
  }, [storageService]);

  const getActiveChat = useCallback(async (): Promise<string | null> => {
    if (!storageService) throw new Error("Storage service is not initialized");
    return await getActiveChatFromStorage(storageService);
  }, [storageService]);

  return {
    storeChat,
    loadChat,
    loadAllChats,
    deleteChat,
    setActiveChat,
    getActiveChat,
    storageService,
  };
};
