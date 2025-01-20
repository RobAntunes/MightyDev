// src/components/ContextPane.tsx

import React, { useCallback, useEffect, useState } from "react";
import {
  Brain,
  FileCode2,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useContext } from "../hooks/useContext";
import { Dialog, DialogContent, DialogTrigger } from "../components/ui/dialog";
import ContextViewer from "./ContextViewer";
import { Button } from "../components/ui/button";
import { Alert, AlertDescription } from "../components/ui/alert";
import type {
  ContextStats,
  QueryContext,
  SearchOptions,
} from "../types/context";
import ContextErrorHandler from "./ContextError";

interface ContextPaneProps {
  className?: string;
  onContextUpdate?: () => void;
}

interface SelectedFile {
  path: string;
  name: string;
}

const ContextPane: React.FC<ContextPaneProps> = ({
  className = "",
  onContextUpdate,
}) => {
  // State management
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [searchResults, setSearchResults] = useState<QueryContext | null>(null);
  const [stats, setStats] = useState<ContextStats | null>(null);

  // Context hook with proper options
  const {
    loading,
    error,
    addFile,
    removeFile,
    searchSimilar,
    clearError,
  } = useContext({
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // File search with debouncing
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (searchTerm.length > 2) {
        try {
          const options: SearchOptions = {
            limit: 5,
            minRelevance: 0.7,
            includeContent: true,
          };
          const results = await searchSimilar(searchTerm, options);
          setSearchResults(results);
        } catch (err) {
          console.error("Search error:", err);
        }
      } else {
        setSearchResults(null);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchSimilar]);

  // File browser handler
  const handleBrowseFile = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });

      if (selected && typeof selected === "string") {
        const pathParts = selected.split(/[\/\\]/);
        const fileName = pathParts[pathParts.length - 1];

        setSelectedFile({
          path: selected,
          name: fileName,
        });
      }
    } catch (err) {
      console.error("Failed to open file dialog:", err);
    }
  }, []);

  // File addition handler
  const handleAddFile = useCallback(async () => {
    if (!selectedFile) return;

    try {
      // Assuming content is read elsewhere or handled backend-side
      await addFile(selectedFile.path);
      setSelectedFile(null);

      if (onContextUpdate) {
        onContextUpdate();
      }
    } catch (err) {
      console.error("Failed to add file:", err);
      // Error will be handled by the error handler component
    }
  }, [selectedFile, addFile, onContextUpdate]);

  // File removal handler
  const handleRemoveFile = useCallback(async (path: string) => {
    try {
      await removeFile(path);
      if (path === selectedFile?.path) {
        setSelectedFile(null);
      }
      if (onContextUpdate) {
        onContextUpdate();
      }
    } catch (err) {
      console.error("Error removing file:", err);
    }
  }, [removeFile, selectedFile, onContextUpdate]);

  // Retry handler for error cases
  const handleRetry = useCallback(async () => {
    if (!selectedFile) return;

    try {
      await addFile(selectedFile.path);
      setSelectedFile(null);
      clearError();

      if (onContextUpdate) {
        onContextUpdate();
      }
    } catch (err) {
      console.error("Failed to add file:", err);
    }
  }, [selectedFile, addFile, clearError, onContextUpdate]);
    
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-4 ${className}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-lime-400" />
            <h2 className="text-lg font-light text-zinc-300">
              Context Manager
            </h2>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading}
            className="h-8 px-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* File Selection Section */}
        <div className="p-4 border-b border-zinc-800/50">
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              onClick={handleBrowseFile}
              disabled={loading}
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Select File
            </Button>
            {selectedFile && (
              <div className="flex-1 text-sm text-zinc-400 truncate">
                {selectedFile.name}
              </div>
            )}
            <Button
              onClick={handleAddFile}
              disabled={!selectedFile || loading}
              size="sm"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {error && (
            <ContextErrorHandler
              onRetry={handleRetry}
              onClear={clearError}
              initialPath={selectedFile?.path}
            />
          )}
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-800/50">
          <div className="flex items-center space-x-2 bg-zinc-800/50 rounded-lg px-3 py-1.5">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              className="bg-transparent text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none flex-1"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4">
          {error
            ? (
              <Alert variant="destructive">
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )
            : searchResults?.chunks && searchResults.chunks.length > 0
            ? (
              <div className="space-y-2">
                {searchResults.chunks.map((chunk) => (
                  <Dialog key={`${chunk.filePath}-${chunk.startLine}`}>
                    <DialogTrigger asChild>
                      <button className="w-full flex items-center justify-between p-3 bg-zinc-800/30 hover:bg-zinc-800/50 rounded-lg group transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileCode2 className="w-4 h-4 text-zinc-400" />
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm text-zinc-300 truncate">
                              {chunk.filePath}
                            </div>
                            <div className="text-xs text-zinc-500">
                              Lines {chunk.startLine}-{chunk.endLine}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(chunk.filePath);
                          }}
                          className="p-1 text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl h-[80vh]">
                      <ContextViewer
                        initialPath={chunk.filePath}
                        onContextUpdate={onContextUpdate}
                      />
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            )
            : (
              <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <FileCode2 className="w-8 h-8 mb-2 text-zinc-600" />
                <p className="text-sm">No files in context</p>
              </div>
            )}
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="p-4 border-t border-zinc-800/50">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                <div className="text-sm text-zinc-500 mb-1">Total Files</div>
                <div className="text-xl text-zinc-200">{stats.totalFiles}</div>
              </div>
              <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                <div className="text-sm text-zinc-500 mb-1">Active Files</div>
                <div className="text-xl text-zinc-200">
                  {stats.activeFiles}
                </div>
              </div>
              <div className="text-center p-2 bg-zinc-800/30 rounded-lg">
                <div className="text-sm text-zinc-500 mb-1">Total Size</div>
                <div className="text-xl text-zinc-200">
                  {Math.round(stats.totalSize / 1024)} KB
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextPane;