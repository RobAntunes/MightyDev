import React, { useState, useCallback } from 'react';
import { Save, Search, Trash2, RefreshCw } from 'lucide-react';
import { useStorage } from '../hooks/useStorage';

const StorageTest = () => {
  const { storeValue, getValue, storeJson, getJson } = useStorage();
  const [key, setKey] = useState('test-key');
  const [value, setValue] = useState('');
  const [retrievedValue, setRetrievedValue] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStore = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (value.startsWith('{') || value.startsWith('[')) {
        // Try to parse as JSON
        const jsonValue = JSON.parse(value);
        await storeJson(key, jsonValue);
      } else {
        await storeValue(key, value);
      }
      setRetrievedValue(null); // Clear previous retrieval
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to store value');
    } finally {
      setLoading(false);
    }
  }, [key, value, storeValue, storeJson]);

  const handleRetrieve = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await getValue(key);
      if (result !== null) {
        try {
          // Try to parse as JSON for pretty display
          const jsonValue = JSON.parse(result);
          setRetrievedValue(JSON.stringify(jsonValue, null, 2));
        } catch {
          // If not JSON, display as is
          setRetrievedValue(result);
        }
      } else {
        setRetrievedValue(null);
        setError('No value found for this key');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrieve value');
      setRetrievedValue(null);
    } finally {
      setLoading(false);
    }
  }, [key, getValue]);

  const handleClear = useCallback(async () => {
    setKey('test-key');
    setValue('');
    setRetrievedValue(null);
    setError(null);
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 p-6 bg-zinc-900/50 rounded-lg border border-zinc-800/50">
        <h2 className="text-xl font-light text-zinc-200">RocksDB Storage Test</h2>
        
        {/* Input Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Key</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full bg-zinc-800/50 rounded-lg px-4 py-2 text-zinc-200"
              placeholder="Enter key..."
            />
          </div>
          
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Value (text or JSON)</label>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full h-32 bg-zinc-800/50 rounded-lg px-4 py-2 text-zinc-200 font-mono"
              placeholder="Enter value..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleStore}
            disabled={loading || !key || !value}
            className="flex items-center gap-2 px-4 py-2 bg-lime-600 hover:bg-lime-700 
                     disabled:bg-zinc-700 rounded-lg text-white transition-colors"
          >
            <Save className="w-4 h-4" />
            Store
          </button>
          
          <button
            onClick={handleRetrieve}
            disabled={loading || !key}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 
                     disabled:bg-zinc-800 rounded-lg text-white transition-colors"
          >
            <Search className="w-4 h-4" />
            Retrieve
          </button>
          
          <button
            onClick={handleClear}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 
                     disabled:bg-zinc-800 rounded-lg text-white transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-2 text-zinc-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Processing...
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Retrieved Value Display */}
        {retrievedValue !== null && (
          <div className="space-y-2">
            <label className="block text-sm text-zinc-400">Retrieved Value:</label>
            <pre className="p-4 bg-zinc-800/50 rounded-lg overflow-auto text-zinc-200 font-mono">
              {retrievedValue}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageTest;