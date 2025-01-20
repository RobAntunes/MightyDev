// src/services/context/Context.ts
import { EventBusAdapter } from "@/types/events";
import type {
  ContextFile,
  ContextFileMetadata,
  QueryContext,
} from "../../types/context";
import { invokeWithAuth } from "../../lib/auth";
import { Auth0Context, Auth0ContextInterface } from "@auth0/auth0-react";

export interface ContextConfig {
  dbPath: string;
  maxFiles: number;
  maxEmbeddings: number;
  chunkSize?: number;
  minChunkOverlap?: number;
  watchFiles: boolean;
}

export class ContextService {
  private static instance: ContextService | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private eventBus: EventBusAdapter;

  private constructor(eventBus: EventBusAdapter) {
    this.eventBus = eventBus;
  }

  /**
   * Adds a file to the context.
   * @param path The file path to add.
   * @returns Metadata of the added context file.
   */
  async addFile(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<ContextFileMetadata> {
    this.ensureInitialized();

    try {
      // Check if file exists
      const exists = await invokeWithAuth(
        "is_file_in_context",
        { path },
        auth0,
      );
      if (exists) {
        throw new Error(`File ${path} is already in context`);
      }
      // Read file content
      const content = await invokeWithAuth(
        "read_context_file",
        { path },
        auth0,
      );
      if (!content) {
        throw new Error(`Unable to read file content from ${path}`);
      }
      // Add to context
      const metadata = await invokeWithAuth("add_to_context", {
        path,
        content,
      }, auth0);
      return metadata;
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Unknown error occurred";
      throw new Error(`Failed to add file: ${message}`);
    }
  }

  /**
   * Removes a file from the context.
   * @param path The file path to remove.
   */
  public async removeFile(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    this.ensureInitialized();
    try {
      await invokeWithAuth("remove_from_context", { path }, auth0);

      await this.eventBus.publish(
        "context:file_removed",
        { path },
        "context-service",
      );
    } catch (error) {
      console.error("Failed to remove file from context:", error);
      throw error;
    }
  }

  /**
   * Searches for similar code snippets based on a query.
   * @param query The search query string.
   * @param limit The maximum number of results to return.
   * @returns The search results.
   */
  public async searchSimilar(
    query: string,
    limit: number = 5,
    auth0: Auth0ContextInterface,
  ): Promise<QueryContext> {
    this.ensureInitialized();
    try {
      return await invokeWithAuth("search_similar_code", {
        query,
        limit,
      }, auth0);
    } catch (error) {
      console.error("Failed to search similar code:", error);
      throw error;
    }
  }

  /**
   * Retrieves context based on a query.
   * @param query The query string.
   * @returns The retrieved context.
   */
  public async getContext(
    query: string,
    auth0: Auth0ContextInterface,
  ): Promise<QueryContext> {
    this.ensureInitialized();
    try {
      return await invokeWithAuth("get_context", { query }, auth0);
    } catch (error) {
      console.error("Failed to get context:", error);
      throw error;
    }
  }

  /**
   * Retrieves the context of a specific file.
   * @param path The file path.
   * @returns The file context or null if not found.
   */
  public async getFileContext(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<ContextFile | null> {
    this.ensureInitialized();
    try {
      return await invokeWithAuth("get_file_context", { path }, auth0);
    } catch (error) {
      console.error("Failed to get file context:", error);
      throw error;
    }
  }

  /**
   * Generates embeddings for the provided text.
   * @param text The input text.
   * @returns An array of numbers representing the embeddings.
   */
  public async generateEmbeddings(
    text: string,
    auth0: Auth0ContextInterface,
  ): Promise<number[]> {
    this.ensureInitialized();
    try {
      return await invokeWithAuth("generate_embeddings", { text }, auth0);
    } catch (error) {
      console.error("Failed to generate embeddings:", error);
      throw error;
    }
  }

  /**
   * Checks if a file is already in the context.
   * @param path The file path to check.
   * @returns A boolean indicating presence in context.
   */
  public async hasFile(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<boolean> {
    this.ensureInitialized();
    try {
      return await invokeWithAuth("is_file_in_context", { path }, auth0);
    } catch (error) {
      console.error("Failed to check file presence:", error);
      throw error;
    }
  }

  /**
   * Waits for the ContextService to be ready.
   */
  public async waitForReady(): Promise<void> {
    if (!this.initPromise) {
      throw new Error(
        "Context service not initialized. Call initialize() first.",
      );
    }
    return this.initPromise;
  }

  /**
   * Checks if the ContextService is initialized.
   * @returns A boolean indicating initialization status.
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Ensures that the ContextService is initialized.
   * This method **no longer** performs internal initialization.
   * It only verifies that initialization has been done externally.
   */
  public ensureInitialized() {
    if (!this.initialized) {
      throw new Error(
        "Context service not initialized. Call initialize() first.",
      );
    }
  }

  /**
   * Retrieves the singleton instance of ContextService.
   * @param eventBus The event bus adapter.
   * @returns The singleton instance.
   */
  public static getInstance(eventBus: EventBusAdapter): ContextService {
    if (!ContextService.instance) {
      ContextService.instance = new ContextService(eventBus);
    }
    return ContextService.instance;
  }
}

/**
 * Factory function to create or retrieve the ContextService instance.
 * @param eventBus The event bus adapter.
 * @returns The singleton ContextService instance.
 */
export function createContextService(
  eventBus: EventBusAdapter,
): ContextService {
  return ContextService.getInstance(eventBus);
}
