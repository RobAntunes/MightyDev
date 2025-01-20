// src/hooks/useContext.ts

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ContextFile,
  ContextStats,
  QueryContext,
  SearchOptions,
} from "../types/context";
import { useAuth0 } from "@auth0/auth0-react";
import { invokeWithAuth } from "../lib/auth";

export interface UseContextSystemOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useContext(options: UseContextSystemOptions = {}) {
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const operationsInProgress = useRef<number>(0);

  const auth0 = useAuth0();

  const startOperation = useCallback(() => {
    operationsInProgress.current += 1;
    setLoading(true);
  }, []);

  const finishOperation = useCallback(() => {
    operationsInProgress.current = Math.max(
      0,
      operationsInProgress.current - 1,
    );
    if (operationsInProgress.current === 0) {
      setLoading(false);
    }
  }, []);

  const addFile = useCallback(async (filePath: string): Promise<void> => {
    startOperation();
    try {
      // Read the file content using the backend command
      const fileContent: string = await invokeWithAuth("read_context_file", {
        path: filePath,
      }, auth0);
      await invokeWithAuth("add_to_context", {
        path: filePath,
        content: fileContent,
      }, auth0);
      setError(null);
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error("Failed to add file");
      setError(error);
      console.error("Add file error:", error, err);
      throw error;
    } finally {
      finishOperation();
    }
  }, [startOperation, finishOperation]);

  const removeFile = useCallback(async (filePath: string): Promise<void> => {
    startOperation();
    try {
      await invokeWithAuth("remove_from_context", { path: filePath }, auth0);
      setError(null);
    } catch (err) {
      const error = err instanceof Error
        ? err
        : new Error("Failed to remove file");
      setError(error);
      console.error("Remove file error:", error, err);
      throw error;
    } finally {
      finishOperation();
    }
  }, [startOperation, finishOperation]);

  const searchSimilar = useCallback(async (
    query: string,
    options?: SearchOptions,
  ): Promise<QueryContext> => {
    startOperation();
    try {
      const results: QueryContext = await invokeWithAuth(
        "search_similar_code",
        {
          query,
          limit: options?.limit || 5,
        },
        auth0,
      );
      setError(null);
      return results;
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Search failed");
      setError(error);
      console.error("Search similar code error:", error, err);
      throw error;
    } finally {
      finishOperation();
    }
  }, [startOperation, finishOperation]);

  const getContext = useCallback(
    async (query: string): Promise<QueryContext> => {
      startOperation();
      try {
        const context: QueryContext = await invokeWithAuth("get_context", {
          query,
        }, auth0);
        setError(null);
        return context;
      } catch (err) {
        const error = err instanceof Error
          ? err
          : new Error("Failed to get context");
        setError(error);
        console.error("Get context error:", error, err);
        throw error;
      } finally {
        finishOperation();
      }
    },
    [startOperation, finishOperation],
  );

  const getFileContext = useCallback(
    async (filePath: string): Promise<ContextFile | null> => {
      startOperation();
      try {
        const context: ContextFile | null = await invokeWithAuth(
          "get_file_context",
          { path: filePath },
          auth0,
        );
        setError(null);
        return context;
      } catch (err) {
        const error = err instanceof Error
          ? err
          : new Error("Failed to get file context");
        setError(error);
        console.error("Get file context error:", error, err);
        throw error;
      } finally {
        finishOperation();
      }
    },
    [startOperation, finishOperation],
  );

  const generateEmbeddings = useCallback(
    async (text: string): Promise<number[]> => {
      startOperation();
      try {
        const embeddings: number[] = await invokeWithAuth(
          "generate_embeddings",
          { text },
          auth0,
        );
        setError(null);
        return embeddings;
      } catch (err) {
        const error = err instanceof Error
          ? err
          : new Error("Failed to generate embeddings");
        setError(error);
        console.error("Generate embeddings error:", error, err);
        throw error;
      } finally {
        finishOperation();
      }
    },
    [startOperation, finishOperation],
  );

  const clearError = useCallback(() => setError(null), []);

  // // Fetch context statistics
  // useEffect(() => {
  //   const fetchStats = async () => {
  //     startOperation();
  //     try {
  //       const fetchedStats: ContextStats = await invokeWithAuth("get_context_stats", {}, auth0);
  //       setStats(fetchedStats);
  //       setError(null);
  //     } catch (err) {
  //       const error = err instanceof Error
  //         ? err
  //         : new Error("Failed to fetch context statistics");
  //       setError(error);
  //       console.error("Fetch stats error:", error, err);
  //     } finally {
  //       finishOperation();
  //     }
  //   };

  //   fetchStats();

  //   if (options.autoRefresh && options.refreshInterval) {
  //     const intervalId = setInterval(fetchStats, options.refreshInterval);
  //     return () => clearInterval(intervalId);
  //   }
  // }, [options.autoRefresh, options.refreshInterval, startOperation, finishOperation]);

  return {
    stats,
    loading,
    error,
    addFile,
    removeFile,
    searchSimilar,
    getContext,
    getFileContext,
    generateEmbeddings,
    clearError,
  };
}
