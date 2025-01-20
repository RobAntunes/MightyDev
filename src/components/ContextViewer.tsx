// src/components/ContextViewer.tsx

import React, { useEffect, useState, useCallback } from "react";
import {
  FileCode2,
  GitFork,
  Import,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useContext } from "../hooks/useContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Alert, AlertDescription } from "../components/ui/alert";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { ContextFile } from "@/types/context";

interface ContextViewerProps {
  initialPath?: string;
  onContextUpdate?: () => void;
}

interface DependencyInfo {
  imports: string[];
  dependencies: string[];
  dependents: string[];
}

const ContextViewer: React.FC<ContextViewerProps> = ({
  initialPath,
  onContextUpdate,
}) => {
  const {
    loading,
    error,
    getFileContext,
    addFile,
    removeFile,
    clearError,
  } = useContext({
    autoRefresh: false,
  });

  const [currentContext, setCurrentContext] = useState<ContextFile | null>(
    null,
  );
  const [newFilePath, setNewFilePath] = useState<string>("");
  const [addingFile, setAddingFile] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("content");

  useEffect(() => {
    if (initialPath) {
      loadFileContext(initialPath);
    }
  }, [initialPath]);

  const loadFileContext = async (path: string) => {
    try {
      const context = await getFileContext(path);
      if (context) {
        setCurrentContext(context);
      }
    } catch (err) {
      console.error("Error loading file context:", err);
    }
  };

  const handleAddFile = async () => {
    setAddingFile(true);
    setAddError(null);
    try {
      await addFile(newFilePath);
      setNewFilePath("");
      if (onContextUpdate) {
        onContextUpdate();
      }
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add file");
    } finally {
      setAddingFile(false);
    }
  };

  const handleRemoveFile = async (path: string) => {
    try {
      await removeFile(path);
      if (path === initialPath) {
        setCurrentContext(null);
      }
      if (onContextUpdate) {
        onContextUpdate();
      }
    } catch (err) {
      console.error("Error removing file:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Add File Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-zinc-400" />
              Add File to Context
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Enter file path..."
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleAddFile}
              disabled={addingFile || !newFilePath}
            >
              {addingFile ? "Adding..." : "Add File"}
            </Button>
          </div>
          {addError && (
            <Alert variant="destructive" className="mt-2">
              <AlertDescription>{addError}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* Current Context View */}
      {currentContext && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
          </TabsList>

          <TabsContent value="content">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="w-5 h-5 text-zinc-400" />
                    File Content
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveFile(currentContext.path)}
                    className="h-8 px-2 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-zinc-800/30 p-4 rounded-lg">
                  <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                    <span>Path: {currentContext.path}</span>
                    <span>
                      Last Updated:{" "}
                      {new Date(currentContext.lastUpdated).toLocaleString()}
                    </span>
                  </div>
                  <pre className="overflow-auto text-sm text-zinc-300 max-h-[600px]">
                    {currentContext.content}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dependencies">
            {/* Placeholder for Dependencies Tab */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-medium flex items-center gap-2">
                  <GitFork className="w-5 h-5 text-zinc-400" />
                  Dependencies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Imports */}
                  <div>
                    <h3 className="text-sm font-medium text-zinc-200 mb-2">
                      Imports
                    </h3>
                    <div className="space-y-2">
                      {currentContext.imports.map((imp, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 bg-zinc-800/50 rounded-lg"
                        >
                          <Import className="w-4 h-4 text-zinc-400" />
                          <span className="text-sm text-zinc-300">{imp}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Additional Dependency Information */}
                  {/* You can expand this section based on available data */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Stats Overview
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Context Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-800/30 rounded-lg">
                <div className="text-sm text-zinc-500 mb-1">Total Files</div>
                <div className="text-2xl text-zinc-200">{stats.totalFiles}</div>
              </div>
              <div className="p-4 bg-zinc-800/30 rounded-lg">
                <div className="text-sm text-zinc-500 mb-1">Active Files</div>
                <div className="text-2xl text-zinc-200">
                  {stats.activeFiles}
                </div>
              </div>
              <div className="p-4 bg-zinc-800/30 rounded-lg">
                <div className="text-sm text-zinc-500 mb-1">Total Size</div>
                <div className="text-2xl text-zinc-200">
                  {Math.round(stats.totalSize / 1024)} KB
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
};

export default ContextViewer;