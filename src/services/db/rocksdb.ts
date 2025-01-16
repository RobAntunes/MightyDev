// src/services/storage/StorageService.ts

import { invoke } from '@tauri-apps/api/core';

export interface StorageError {
    code: string;
    message: string;
}

export class StorageService {
    /**
     * Store a value in the database
     * @param key The key to store the value under
     * @param value The value to store
     * @throws {StorageError} If the operation fails
     */
    async store(key: string, value: string): Promise<void> {
        return invoke('store_value', { key, value });
    }

    /**
     * Retrieve a value from the database
     * @param key The key to retrieve
     * @returns The value if found, null otherwise
     * @throws {StorageError} If the operation fails
     */
    async get(key: string): Promise<string | null> {
        const result = await invoke<string | null>('get_value', { key });
        return result;
    }

    /**
     * Delete a value from the database
     * @param key The key to delete
     * @throws {StorageError} If the operation fails
     */
    async delete(key: string): Promise<void> {
        return invoke('delete_value', { key });
    }

    /**
     * Scan for all key-value pairs with a given prefix
     * @param prefix The prefix to scan for
     * @returns An array of key-value pairs
     * @throws {StorageError} If the operation fails
     */
    async scanPrefix(prefix: string): Promise<Array<[string, string]>> {
        return invoke<Array<[string, string]>>('scan_prefix', { prefix });
    }

    /**
     * Store a JSON value in the database
     * @param key The key to store the value under
     * @param value The value to store
     * @throws {StorageError} If the operation fails
     */
    async storeJson<T>(key: string, value: T): Promise<void> {
        return this.store(key, JSON.stringify(value));
    }

    /**
     * Retrieve a JSON value from the database
     * @param key The key to retrieve
     * @returns The parsed value if found, null otherwise
     * @throws {StorageError} If the operation fails
     */
    async getJson<T>(key: string): Promise<T | null> {
        const result = await this.get(key);
        if (result === null) return null;
        return JSON.parse(result) as T;
    }
}