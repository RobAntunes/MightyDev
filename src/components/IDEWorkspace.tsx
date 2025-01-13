import React, { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import IntegratedFileBrowser from './FileBrowser';
import MonacoEditor from './MonacoEditor';
import ResizablePanel from './ResizablePanel';

interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  metadata: {
    createdAt: string;
    modifiedAt: string;
    size: number;
    permissions: string;
  };
  children?: FileSystemNode[];
}

const IDEWorkspace: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<FileSystemNode | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const isMounted = useRef(true);

  // Track component lifecycle
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false; // Set to false on unmount
    };
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(async (node: FileSystemNode) => {
    if (node.type === 'file') {
      try {
        const content = await invoke<string>('read_file', { path: node.path });
        if (isMounted.current) {
          setFileContent(content);
          setCurrentFile(node);
        }
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  }, []);

  // Handle file content changes in the editor
  const handleFileChange = useCallback((content: string | undefined) => {
    if (isMounted.current && content !== undefined) {
      setFileContent(content);
    }
  }, []);

  // Handle file saving
  const handleFileSave = useCallback(
    async (content: string) => {
      if (currentFile) {
        try {
          await invoke('write_file', {
            path: currentFile.path,
            content,
          });
          console.log('File saved successfully');
        } catch (error) {
          console.error('Error saving file:', error);
        }
      }
    },
    [currentFile]
  );

  return (
    <div className="flex h-full bg-zinc-900">
      <ResizablePanel
        direction="horizontal"
        position="left"
        minWidth={200}
        minHeight={Infinity}
        initialHeight={Infinity}
        initialWidth={300}
      >
        <IntegratedFileBrowser onFileSelect={handleFileSelect} />
      </ResizablePanel>

      <div className="flex-1">
        {currentFile ? (
          <MonacoEditor
            path={currentFile.path}
            content={fileContent}
            onChange={handleFileChange}
            onSave={handleFileSave}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <p className="text-sm font-light">Select a file to begin editing</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IDEWorkspace;