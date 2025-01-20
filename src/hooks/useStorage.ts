// src/hooks/useStorage.ts

import { useCallback, useMemo, useEffect, useState } from 'react';
import { Storage, StorageService } from '../services/db/rocksdb';

export function useStorage() {
    const [storageInitialized, setStorageInitialized] = useState<boolean>(false);
    const [storageError, setStorageError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const storage = Storage.getDefault();
            setStorageInitialized(true);
        } catch (error) {
            console.error('Storage not initialized:', error);
            setStorageError('Storage not initialized. Please restart the application.');
        }
    }, []);

    const handleStorageError = useCallback((error: any) => {
        console.error('Storage operation failed:', error);
        // Implement user-facing error handling here (e.g., show a toast)
    }, []);

    const storeValue = useCallback(async (key: string, value: string) => {
        try {
            await Storage.getDefault().store(key, value);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [handleStorageError]);

    const getValue = useCallback(async (key: string) => {
        try {
            return await Storage.getDefault().get(key);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [handleStorageError]);

    const storeJson = useCallback(async <T,>(key: string, value: T) => {
        try {
            await Storage.getDefault().storeJson(key, value);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [handleStorageError]);

    const getJson = useCallback(async <T,>(key: string) => {
        try {
            return await Storage.getDefault().getJson<T>(key);
        } catch (error) {
            handleStorageError(error);
            throw error;
        }
    }, [handleStorageError]);

    return {
        storeValue,
        getValue,
        storeJson,
        getJson,
        storageInitialized,
        storageError,
    };
}