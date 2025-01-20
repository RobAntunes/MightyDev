// components/chat/ChatWorkspace.tsx

import React, { useEffect, useRef, useState } from "react";
import {
  createAssistantMessage,
  createErrorMessage,
  createPendingAssistantMessage,
  createUserMessage,
  Message,
} from "../types/messages";
import { Chat, ChatState } from "../types/chat";
import ChatSelector from "./ChatSelector";
import ChatInterface from "./ChatInterface";
import {
  deleteChat,
  getActiveChat,
  loadAllChats,
  setActiveChat,
  storeChat,
} from "../lib/rocksdb";
import { eventSystem } from "../classes/events/manager";
import { EventPayload } from "../types/events";

export default function ChatWorkspace() {
  const [chatState, setChatState] = useState<ChatState>({
    chats: {},
    activeChat: null,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const subscriptionsRef = useRef<{ response?: string; error?: string }>({});

  // Load chat state on mount
  useEffect(() => {
    const loadChatState = async () => {
      try {
        const savedChats = await loadAllChats();
        const activeChat = await getActiveChat();

        // Only set activeChat if it exists in savedChats
        const validActiveChat = activeChat && savedChats[activeChat]
          ? activeChat
          : null;
        setChatState({
          chats: savedChats,
          activeChat: validActiveChat,
        });
      } catch (error) {
        console.error("Error loading chat state:", error);
      }
    };

    loadChatState();
    return () => {
      cleanupSubscriptions();
    };
  }, []);

  const cleanupSubscriptions = async () => {
    try {
      if (subscriptionsRef.current.response) {
        await eventSystem.getEventBus().unsubscribe(
          subscriptionsRef.current.response,
        );
      }
      if (subscriptionsRef.current.error) {
        await eventSystem.getEventBus().unsubscribe(
          subscriptionsRef.current.error,
        );
      }
      subscriptionsRef.current = {};
    } catch (error) {
      console.error("Error cleaning up subscriptions:", error);
    }
  };

  // Save chat state whenever it changes
  useEffect(() => {
    const saveChatState = async () => {
      try {
        if (chatState.activeChat) {
          const activeChat = chatState.chats[chatState.activeChat];
          if (activeChat) {
            await storeChat(activeChat);
            await setActiveChat(chatState.activeChat);
          }
        }
      } catch (error) {
        console.error("Error saving chat state:", error);
      }
    };

    saveChatState();
  }, [chatState]);

  const handleCreateChat = async () => {
    const timestamp = new Date().toISOString();
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: `Chat ${Object.keys(chatState.chats).length + 1}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
    };

    setChatState((prev: ChatState) => ({
      chats: {
        ...prev.chats,
        [newChat.id]: newChat,
      },
      activeChat: newChat.id,
    }));
  };

  const handleSelectChat = (id: string) => {
    setChatState((prev: ChatState) => ({
      ...prev,
      activeChat: id,
    }));
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteChat(id);

      setChatState((prev: ChatState) => {
        const newChats = { ...prev.chats };
        delete newChats[id];

        return {
          chats: newChats,
          activeChat: prev.activeChat === id ? null : prev.activeChat,
        };
      });

      if (chatState.activeChat === id) {
        await setActiveChat(null);
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const updateChatMessages = (
    chatId: string,
    updateFn: (messages: Message[]) => Message[],
  ) => {
    setChatState((prev: ChatState) => ({
      ...prev,
      chats: {
        ...prev.chats,
        [chatId]: {
          ...prev.chats[chatId],
          messages: updateFn(prev.chats[chatId].messages),
          updatedAt: new Date().toISOString(),
        },
      },
    }));
  };

  const handleSendMessage = async (content: string) => {
    if (!chatState.activeChat || isProcessing) return;
    const chatId = chatState.activeChat;

    setIsProcessing(true);
    await cleanupSubscriptions();

    const userMessage = createUserMessage(content);
    const pendingMessage = createPendingAssistantMessage();

    // Add user message and pending message to chat
    updateChatMessages(
      chatId,
      (messages) => [...messages, userMessage, pendingMessage],
    );

    try {
      // Set up response handler
      const responseSubscription = await eventSystem.getEventBus().subscribe(
        "ai:response",
        async (event: EventPayload<{ text: string }>) => {
          const assistantMessage = createAssistantMessage(event.data.text);
          updateChatMessages(
            chatId,
            (messages) =>
              messages.map((msg) =>
                msg.id === pendingMessage.id ? assistantMessage : msg
              ),
          );
          setIsProcessing(false);
        },
      );

      // Set up error handler
      const errorSubscription = await eventSystem.getEventBus().subscribe(
        "ai:error",
        async (event: EventPayload<{ error: string }>) => {
          const errorMsg = createErrorMessage(event.data.error);
          updateChatMessages(
            chatId,
            (messages) =>
              messages.map((msg) =>
                msg.id === pendingMessage.id ? errorMsg : msg
              ),
          );
          setIsProcessing(false);
        },
      );

      subscriptionsRef.current = {
        response: responseSubscription,
        error: errorSubscription,
      };

      // Get conversation history for context
      const conversationHistory = chatState.chats[chatId].messages
        .filter((msg: Message) => msg.status === "complete")
        .map((msg: Message) => ({
          role: msg.role,
          content: msg.content[0].content,
        }));

      // Add the new message
      conversationHistory.push({
        role: "user",
        content: content,
      });

      // Send request
      const payload = {
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1024,
        messages: conversationHistory,
      };

      await eventSystem.getEventBus().publish(
        "ai:request",
        payload,
        "chat-workspace",
      );
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      const errorMessage = createErrorMessage(
        error instanceof Error ? error.message : "Unknown error",
      );
      updateChatMessages(
        chatId,
        (messages) =>
          messages.map((msg) =>
            msg.id === pendingMessage.id ? errorMessage : msg
          ),
      );
      setIsProcessing(false);
      await cleanupSubscriptions();
    }
  };

  return (
    <div className="flex h-full">
      <ChatSelector
        chats={chatState.chats}
        activeChat={chatState.activeChat}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onDeleteChat={handleDeleteChat}
      />

      <div className="flex-1">
        {chatState.activeChat && chatState.chats[chatState.activeChat]
          ? (
            <ChatInterface
              messages={chatState.chats[chatState.activeChat].messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
            />
          )
          : (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <p>Select or create a chat to begin</p>
            </div>
          )}
      </div>
    </div>
  );
}
