import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  Plus,
  Search,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

interface FileSystemError {
  code: string;
  message: string;
  path?: string;
}

interface FileItemProps {
  node: FileSystemNode;
  depth?: number;
  isOpen?: boolean;
  onToggle: (path: string) => void;
  onSelect: (node: FileSystemNode) => void;
}

interface IntegratedFileBrowserProps {
  onFileSelect?: (node: FileSystemNode) => void;
  rootPath: string;
  className?: string;
}

const FileItem: React.FC<FileItemProps> = ({ 
  node, 
  depth = 0, 
  isOpen = false, 
  onToggle,
  onSelect
}) => {
  const isFolder = node.type === 'directory';
  const Icon = isFolder ? Folder : FileText;
  
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      onToggle(node.path);
    } else {
      onSelect(node);
    }
  };
  
  return (
    <div 
      className={`
        group flex items-center px-3 py-1.5 rounded-lg 
        transition-all duration-200 ease-in-out
        hover:bg-zinc-800/50 cursor-pointer
        ${depth > 0 ? 'ml-4' : ''}
      `}
      onClick={handleClick}
    >
      <div className="flex items-center space-x-2 flex-1">
        {isFolder && (
          <div className="w-4 h-4 flex items-center justify-center transition-transform duration-200">
            {isOpen ? 
              <ChevronDown className="w-3 h-3 text-zinc-500" /> : 
              <ChevronRight className="w-3 h-3 text-zinc-500" />
            }
          </div>
        )}
        <Icon className={`w-4 h-4 ${isFolder ? 'text-lime-400' : 'text-zinc-500'}`} />
        <span className="text-sm font-light text-zinc-300">{node.name}</span>
      </div>
      <div className="hidden group-hover:flex items-center space-x-2 transition-opacity duration-200">
        <Sparkles className="w-3 h-3 text-lime-400 opacity-60" />
      </div>
    </div>
  );
};

const IntegratedFileBrowser: React.FC<IntegratedFileBrowserProps> = ({ 
  onFileSelect,
  rootPath,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<FileSystemNode[]>([]);
  const [error, setError] = useState<FileSystemError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDirectory = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      const entries = await invoke<FileSystemNode[]>('read_directory', { path });
      if (path === rootPath) {
        setFiles(entries);
      } else {
        // Update the children of the expanded directory
        setFiles(prev => updateChildren(prev, path, entries));
      }
      setError(null);
    } catch (err) {
      setError(err as FileSystemError);
    } finally {
      setIsLoading(false);
    }
  }, [rootPath]);

  const updateChildren = (
    nodes: FileSystemNode[], 
    parentPath: string, 
    newChildren: FileSystemNode[]
  ): FileSystemNode[] => {
    return nodes.map(node => {
      if (node.path === parentPath) {
        return { ...node, children: newChildren };
      }
      if (node.children) {
        return { ...node, children: updateChildren(node.children, parentPath, newChildren) };
      }
      return node;
    });
  };

  const toggleFolder = useCallback(async (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
        loadDirectory(path);
      }
      return next;
    });
  }, [loadDirectory]);

  const handleFileSelect = useCallback((node: FileSystemNode) => {
    onFileSelect?.(node);
  }, [onFileSelect]);

  // Setup file system watcher
  useEffect(() => {
    const setupWatcher = async () => {
      const unlisten = await listen('fs-change', (event) => {
        const { path, type } = event.payload as { path: string; type: 'create' | 'modify' | 'delete' };
        if (path.startsWith(rootPath)) {
          // Reload the affected directory
          const parentPath = path.substring(0, path.lastIndexOf('/'));
          loadDirectory(parentPath);
        }
      });

      return () => {
        unlisten();
      };
    };

    setupWatcher();
  }, [rootPath, loadDirectory]);

  // Initial load
  useEffect(() => {
    loadDirectory(rootPath);
  }, [rootPath, loadDirectory]);

  const renderFileTree = (items: FileSystemNode[], depth = 0) => {
    return items.map(item => (
      <React.Fragment key={item.path}>
        <FileItem
          node={item}
          depth={depth}
          isOpen={expandedPaths.has(item.path)}
          onToggle={toggleFolder}
          onSelect={handleFileSelect}
        />
        {item.type === 'directory' && 
         item.children && 
         expandedPaths.has(item.path) && 
         renderFileTree(item.children, depth + 1)}
      </React.Fragment>
    ));
  };

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 rounded-lg">
        <div className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm font-medium">Error: {error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-zinc-900/90 rounded-lg backdrop-blur-md border border-zinc-800/50 ${className}`}>
      <div className="p-3 border-b border-zinc-800/80">
        <div className="flex items-center space-x-2 bg-zinc-800/50 rounded-lg px-3 py-1.5 backdrop-blur-sm">
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
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Sparkles className="w-5 h-5 text-lime-400 animate-spin" />
          </div>
        ) : (
          renderFileTree(files)
        )}
      </div>
    </div>
  );
};

export default IntegratedFileBrowser;