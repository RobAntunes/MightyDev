import React, { useState, useCallback } from 'react';
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
  
  const handleFileSelect = useCallback(async (node: FileSystemNode) => {
    if (node.type === 'file') {
      try {
        const content = await invoke<string>('read_file', { path: node.path });
        setFileContent(content);
        setCurrentFile(node);
      } catch (error) {
        console.error('Error reading file:', error);
      }
    }
  }, []);

  const handleFileChange = useCallback((content: string | undefined) => {
    if (content !== undefined) {
      setFileContent(content);
    }
  }, []);

  const handleFileSave = useCallback(async (content: string) => {
    if (currentFile) {
      try {
        await invoke('write_file', { 
          path: currentFile.path, 
          content 
        });
        console.log('File saved successfully');
      } catch (error) {
        console.error('Error saving file:', error);
      }
    }
  }, [currentFile]);

  return (
    <div className="flex h-full bg-zinc-900">
      <ResizablePanel
        defaultSize={300}
        minSize={200}
        maxSize={500}
        direction="horizontal"
        className="border-r border-zinc-800/50"
      >
        <IntegratedFileBrowser
          onFileSelect={handleFileSelect}
        />
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