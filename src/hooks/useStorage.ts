// src/hooks/useStorage.ts

import { useCallback, useMemo } from 'react';
import { StorageService } from '../services/db/rocksdb';

export function useStorage() {
    const storage = useMemo(() => new StorageService(), []);

    const handleStorageError = useCallback((error: any) => {
        console.error('Storage operation failed:', error);
        // You might want to show a toast notification or handle errors differently
    }, []);

    const storeValue = useCallback(async (key: string, value: string) => {
        try {
            await storage.store(key, value);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [storage, handleStorageError]);

    const getValue = useCallback(async (key: string) => {
        try {
            return await storage.get(key);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [storage, handleStorageError]);

    const storeJson = useCallback(async <T,>(key: string, value: T) => {
        try {
            await storage.storeJson(key, value);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [storage, handleStorageError]);

    const getJson = useCallback(async <T,>(key: string) => {
        try {
            return await storage.getJson<T>(key);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [storage, handleStorageError]);

    return {
        storeValue,
        getValue,
        storeJson,
        getJson,
        storage, // Expose the full service if needed
    };
}