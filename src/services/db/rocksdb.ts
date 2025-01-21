// src/services/storage/StorageService.ts

import { Auth0Context, Auth0ContextInterface } from "@auth0/auth0-react";
import { invokeWithAuth } from "../../lib/auth";

export interface StorageError {
    code: string;
    message: string;
}

export interface StorageOptions {
    retryAttempts?: number;
    retryDelay?: number;
}

export class StorageService {
    private static instance: StorageService | null = null;
    private initialized: boolean = false;
    private options: Required<StorageOptions>;
    private auth0: Auth0ContextInterface;

    private constructor(
        auth0: Auth0ContextInterface,
        options: StorageOptions = {},
    ) {
        this.auth0 = auth0;
        this.options = {
            retryAttempts: options.retryAttempts ?? 3,
            retryDelay: options.retryDelay ?? 1000,
        };
    }

    public static getInstance(
        auth0: Auth0ContextInterface,
        options?: StorageOptions,
    ): StorageService {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService(auth0, options);
            this.instance!.toggleInitialized();
        }
        return StorageService.instance;
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
    ): Promise<T> {
        if (!this.initialized) {
            throw new Error("Storage service not initialized");
        }

        let lastError: Error | null = null;
        for (
            let attempt = 1;
            attempt <= this.options.retryAttempts;
            attempt++
        ) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                if (attempt < this.options.retryAttempts) {
                    await new Promise((resolve) =>
                        setTimeout(resolve, this.options.retryDelay * attempt)
                    );
                }
            }
        }
        throw lastError;
    }

    public async store(
        key: string,
        value: string,
    ): Promise<void> {
        return this.withRetry(() =>
            invokeWithAuth("store_value", { key, value }, this.auth0)
        );
    }

    public async get(
        key: string,
    ): Promise<string | null> {
        return this.withRetry(() =>
            invokeWithAuth("get_value", { key }, this.auth0)
        );
    }

    public async delete(
        key: string,
    ): Promise<void> {
        return this.withRetry(() =>
            invokeWithAuth("delete_value", { key }, this.auth0)
        );
    }

    public async scanPrefix(
        prefix: string,
    ): Promise<Array<[string, string]>> {
        return this.withRetry(() =>
            invokeWithAuth("scan_prefix", { prefix }, this.auth0)
        );
    }

    public async storeJson<T>(
        key: string,
        value: T,
    ): Promise<void> {
        const serialized = JSON.stringify(value);
        return this.store(key, serialized);
    }

    public async getJson<T>(
        key: string,
    ): Promise<T | null> {
        const result = await this.get(key);
        if (result === null) return null;
        return JSON.parse(result) as T;
    }
    public toggleInitialized() {
        this.initialized = !this.initialized;
        return this;
    }

    public isInitialized(): boolean {
        return this.initialized;
    }
}