// src/services/vector/LanceDBService.ts

import { invokeWithAuth } from "../../lib/auth";
import { Auth0ContextInterface } from "@auth0/auth0-react";


export interface VectorMetadata {
    id: string;
    path: string;
    lastUpdated: number;
}

export interface SearchResult {
    distance: number;
    metadata: VectorMetadata;
}

export interface VectorStoreConfig {
    dimensions: number;
    metric?: "cosine" | "euclidean" | "dot";
}

export class LanceDBService {
    private static instance: LanceDBService | null = null;
    private config: VectorStoreConfig;
    private auth0: Auth0ContextInterface;

    private constructor(
        config: VectorStoreConfig,
        auth0: Auth0ContextInterface,
    ) {
        this.config = config;
        this.auth0 = auth0;
    }

    public static getInstance(
        auth0: Auth0ContextInterface,
        config?: VectorStoreConfig,
    ): LanceDBService {
        if (!LanceDBService.instance && config) {
            LanceDBService.instance = new LanceDBService(config, auth0);
        }
        return LanceDBService.instance!;
    }

    /**
     * Store vectors for a given content with associated metadata
     */
    public async storeVectors(
        content: string,
        metadata: VectorMetadata,
        auth0: Auth0ContextInterface,
    ): Promise<void> {
        try {
            await invokeWithAuth("store_vectors", {
                content,
                metadata,
            }, auth0);
        } catch (error) {
            console.error("Failed to store vectors:", error);
            throw new Error(`Vector storage failed: ${error}`);
        }
    }

    /**
     * Search for similar content using vector similarity
     */
    public async searchSimilar(
        query: string,
        limit: number = 5,
        auth0: Auth0ContextInterface,
    ): Promise<SearchResult[]> {
        try {
            return await invokeWithAuth("search_similar", {
                query,
                limit,
            }, auth0);
        } catch (error) {
            console.error("Vector similarity search failed:", error);
            throw new Error(`Search failed: ${error}`);
        }
    }

    /**
     * Delete vectors associated with a specific file ID
     */
    public async deleteVectors(
        id: string,
        auth0: Auth0ContextInterface,
    ): Promise<void> {
        try {
            await invokeWithAuth("delete_vectors", { id }, auth0);
        } catch (error) {
            console.error("Failed to delete vectors:", error);
            throw new Error(`Vector deletion failed: ${error}`);
        }
    }

    /**
     * Update vectors for existing content
     */
    public async updateVectors(
        content: string,
        metadata: VectorMetadata,
        auth0: Auth0ContextInterface,
    ): Promise<void> {
        try {
            await this.deleteVectors(metadata.id, auth0);
            await this.storeVectors(content, metadata, auth0);
        } catch (error) {
            console.error("Failed to update vectors:", error);
            throw new Error(`Vector update failed: ${error}`);
        }
    }
}

// Export a convenience function to create or get the service
export const createVectorStore = (
    auth0: Auth0ContextInterface,
    config?: VectorStoreConfig,
): LanceDBService => {
    return LanceDBService.getInstance(auth0, config);
};
