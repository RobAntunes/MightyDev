// components/chat/ChatWorkspace.tsx

import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createAssistantMessage,
  createErrorMessage,
  createPendingAssistantMessage,
  createUserMessage,
} from "../types/messages";
import { Chat, ChatState } from "../types/chat";
import ChatSelector from "./ChatSelector";
import ChatInterface from "./ChatInterface";
import { eventSystem } from "../classes/events/manager";
import {
  AI_EVENTS,
  AIErrorEvent,
  AIMessage,
  AIRequestPayload,
  AIResponseEvent,
} from "../types/ai";
import { useChatStorage } from "../hooks/useChatStorage";

interface Subscriptions {
  response?: string;
  error?: string;
}

export default function ChatWorkspace() {
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const subscriptionsRef = useRef<Subscriptions>({});

  const {
    loadAllChats,
    deleteChat,
    setActiveChat,
    getActiveChat,
  } = useChatStorage();

  const cleanupSubscriptions = useCallback(async () => {
    try {
      const eventBus = eventSystem.getEventBus();
      if (subscriptionsRef.current.response) {
        await eventBus.unsubscribe(subscriptionsRef.current.response);
      }
      if (subscriptionsRef.current.error) {
        await eventBus.unsubscribe(subscriptionsRef.current.error);
      }
      subscriptionsRef.current = {};
    } catch (error) {
      console.error("Error cleaning up subscriptions:", error);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const chats = await loadAllChats();
        const activeChat = await getActiveChat();
        setChatState({
          chats,
          activeChat,
        });
      } catch (error) {
        console.error("Error loading chat state:", error);
      }
    })();

    return () => {
      cleanupSubscriptions();
    };
  }, [loadAllChats, getActiveChat, cleanupSubscriptions]);

  const updateChatMessages = (
    chatId: string,
    updateFn: (messages: AIMessage[]) => AIMessage[],
  ) => {
    setChatState((prev) => {
      if (!prev) return null;
      return {
        chats: {
          ...prev.chats,
          [chatId]: {
            ...prev.chats[chatId],
            messages: updateFn(prev.chats[chatId].messages),
            updatedAt: new Date().toISOString(),
          },
        },
        activeChat: prev.activeChat,
      };
    });
  };

  const handleSendMessage = async (content: string) => {
    if (!chatState?.activeChat || isProcessing) return; // Fixed condition
    const chatId = chatState.activeChat;
    try {
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
        const eventBus = eventSystem.getEventBus();

        // Set up response handler
        const responseSubscription = await eventBus.subscribe(
          AI_EVENTS.RESPONSE,
          async (event: AIResponseEvent) => {
            console.log("EVENT", event);

            if (!event?.data?.id) {
              console.error("Invalid AIResponseEvent structure:", event);
              return;
            }

            if (event.data.id !== pendingMessage.id) return;

            const assistantMessage = createAssistantMessage(
              event.data.text,
              pendingMessage.id,
            );
            updateChatMessages(
              chatId,
              (messages) =>
                messages.map((msg) =>
                  msg.id === pendingMessage.id ? assistantMessage : msg
                ),
            );
            setIsProcessing(false);
            await cleanupSubscriptions();
          },
        );

        // Set up error handler
        const errorSubscription = await eventBus.subscribe(
          AI_EVENTS.ERROR,
          async (event: AIErrorEvent) => {
            console.log("EVENT", event);
            if (!event?.data?.id) {
              console.error("Invalid AIErrorEvent structure:", event);
              return;
            }

            if (event.data.id !== pendingMessage.id) return;

            const errorMsg = createErrorMessage(
              event.data.error,
              pendingMessage.id,
            );
            updateChatMessages(
              chatId,
              (messages) =>
                messages.map((msg) =>
                  msg.id === pendingMessage.id ? errorMsg : msg
                ),
            );
            setIsProcessing(false);
            await cleanupSubscriptions();
          },
        );

        subscriptionsRef.current = {
          response: responseSubscription,
          error: errorSubscription,
        };

        // Get conversation history for context
        const conversationHistory: AIMessage[] = chatState.chats[chatId]
          .messages
          .filter((msg: AIMessage) => msg.status === "complete")
          .map((msg: AIMessage) => ({
            ...msg,
          }));

        // Add the new user message
        conversationHistory.push(createUserMessage(content));

        // Send request with generated ID
        const requestId = pendingMessage.id;
        const payload: AIRequestPayload = {
          id: requestId,
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1024,
          messages: conversationHistory,
        };

        await eventBus.publish(
          AI_EVENTS.REQUEST,
          payload,
          "chat-workspace",
        );
      } catch (error) {
        console.error("Error in handleSendMessage:", error);
        const errorMessage = createErrorMessage(
          error instanceof Error ? error.message : "Unknown error",
          pendingMessage.id,
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
    } catch (e) {
      console.log(e);
      setIsProcessing(false);
    }
  };

  const handleCreateChat = async () => {
    const timestamp = new Date().toISOString();
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: `Chat ${Object.keys(chatState?.chats ?? {}).length + 1}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [],
    };

    setChatState((prev) => {
      if (!prev) return null;
      return {
        chats: {
          ...prev.chats,
          [newChat.id]: newChat,
        },
        activeChat: newChat.id,
      };
    });
  };

  const handleSelectChat = (id: string) => {
    setChatState((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        activeChat: id,
      };
    });
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteChat(id);

      const updatedChats = { ...chatState?.chats };
      delete updatedChats[id];

      setChatState({
        chats: updatedChats,
        activeChat: chatState?.activeChat === id
          ? null
          : chatState?.activeChat ?? null,
      });

      if (chatState?.activeChat === id) {
        await setActiveChat(null);
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  return (
    <div className="flex h-full">
      <ChatSelector
        chats={chatState?.chats ?? {}}
        activeChat={chatState?.activeChat ?? null}
        onSelectChat={handleSelectChat}
        onCreateChat={handleCreateChat}
        onDeleteChat={handleDeleteChat}
      />
      <div className="flex-1">
        {chatState?.activeChat && chatState.chats[chatState.activeChat]
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
