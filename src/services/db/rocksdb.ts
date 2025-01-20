// src/services/db/rocksdb.ts

import { Auth0ContextInterface } from "@auth0/auth0-react";
import { invokeWithAuth } from "../../lib/auth"

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
    private options: Required<StorageOptions>;

    private constructor(options: StorageOptions = {}) {
        this.options = {
            retryAttempts: options.retryAttempts ?? 3,
            retryDelay: options.retryDelay ?? 1000,
        };
    }

    public static getInstance(options?: StorageOptions): StorageService {
        if (!StorageService.instance) {
            StorageService.instance = new StorageService(options);
        }
        return StorageService.instance;
    }

    private async withRetry<T>(
        operation: () => Promise<T>,
    ): Promise<T> {
        let lastError: Error | null = null;

        for (
            let attempt = 1; attempt <= this.options.retryAttempts; attempt++
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
        auth0: Auth0ContextInterface,
    ): Promise<void> {
        return this.withRetry(() =>
            invokeWithAuth("store_value", { key, value }, auth0)
        );
    }
    public async get(
        key: string,
        auth0: Auth0ContextInterface,
    ): Promise<string | null> {
        return this.withRetry(() =>
            invokeWithAuth("get_value", { key }, auth0)
        );
    }

    public async delete(
        key: string,
        auth0: Auth0ContextInterface,
    ): Promise<void> {
        return this.withRetry(() =>
            invokeWithAuth("delete_value", { key }, auth0)
        );
    }

    public async scanPrefix(
        prefix: string,
        auth0: Auth0ContextInterface,
    ): Promise<Array<[string, string]>> {
        return this.withRetry(() =>
            invokeWithAuth("scan_prefix", {
                prefix,
            }, auth0)
        );
    }

    public async storeJson<T>(
        key: string,
        value: T,
        auth0: Auth0ContextInterface,
    ): Promise<void> {
        const serialized = JSON.stringify(value);
        return this.store(key, serialized, auth0);
    }

    public async getJson<T>(
        key: string,
        auth0: Auth0ContextInterface,
    ): Promise<T | null> {
        const result = await this.get(key, auth0);
        if (result === null) return null;
        return JSON.parse(result) as T;
    }
}

// Storage namespace
export namespace Storage {
    export interface Options extends StorageOptions {}
    export interface Error extends StorageError {}

    let defaultInstance: StorageService | null = null;

    export function initialize(options?: Options): StorageService {
        if (!defaultInstance) {
            defaultInstance = StorageService.getInstance(options);
            console.log("StorageService initialized.");
        }
        return defaultInstance;
    }

    export function getDefault(): StorageService {
        if (!defaultInstance) {
            throw new Error(
                "Storage not initialized. Call initialize() first.",
            );
        }
        return defaultInstance;
    }
}
