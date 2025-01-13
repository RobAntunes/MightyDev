import { invoke } from '@tauri-apps/api/core';
import { UnlistenFn } from '@tauri-apps/api/event';

export interface FileSystemNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string;
  metadata: FileMetadata;
  children?: FileSystemNode[];
}

export interface FileMetadata {
  createdAt: string;
  modifiedAt: string;
  size: number;
  permissions: string;
}

export interface FileSystemError {
  code: string;
  message: string;
  path?: string;
}

export interface FileSystemEvents {
  onChange: (path: string, type: 'create' | 'modify' | 'delete') => void;
  onError: (error: FileSystemError) => void;
}

export interface FileSystemOptions {
  recursive?: boolean;
  baseDir?: string;
}

export interface FileSystemOperations {
  readDirectory(path: string, options?: FileSystemOptions): Promise<FileSystemNode[]>;
  readFile(path: string): Promise<Uint8Array>;
  readTextFile(path: string): Promise<string>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  writeTextFile(path: string, contents: string): Promise<void>;
  createDirectory(path: string, options?: FileSystemOptions): Promise<void>;
  exists(path: string): Promise<boolean>;
  delete(path: string, options?: FileSystemOptions): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
  copyFile(source: string, destination: string): Promise<void>;
  metadata(path: string): Promise<FileMetadata>;
  watch(path: string, events: FileSystemEvents): Promise<() => void>;
}

export class TauriFileSystem implements FileSystemOperations {
  private watchHandlers: Map<string, UnlistenFn> = new Map();

  async readDirectory(path: string, options?: FileSystemOptions): Promise<FileSystemNode[]> {
    try {
      const entries = await invoke<FileSystemNode[]>('plugin:fs|read_dir', {
        path,
        options
      });
      return entries;
    } catch (error) {
      throw this.handleError(error, 'Failed to read directory');
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    try {
      const result = await invoke<number[]>('plugin:fs|read_file', { path });
      return new Uint8Array(result);
    } catch (error) {
      throw this.handleError(error, 'Failed to read file');
    }
  }

  async readTextFile(path: string): Promise<string> {
    try {
      return await invoke<string>('plugin:fs|read_text_file', { path });
    } catch (error) {
      throw this.handleError(error, 'Failed to read text file');
    }
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    try {
      await invoke('plugin:fs|write_file', {
        path,
        data: Array.from(data)
      });
    } catch (error) {
      throw this.handleError(error, 'Failed to write file');
    }
  }

  async writeTextFile(path: string, contents: string): Promise<void> {
    try {
      await invoke('plugin:fs|write_text_file', { path, contents });
    } catch (error) {
      throw this.handleError(error, 'Failed to write text file');
    }
  }

  async createDirectory(path: string, options?: FileSystemOptions): Promise<void> {
    try {
      await invoke('plugin:fs|create_dir', { path, options });
    } catch (error) {
      throw this.handleError(error, 'Failed to create directory');
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('plugin:fs|exists', { path });
    } catch (error) {
      throw this.handleError(error, 'Failed to check existence');
    }
  }

  async delete(path: string, options?: FileSystemOptions): Promise<void> {
    try {
      const metadata = await this.metadata(path);
      const stats = await invoke<{ isDir: boolean }>('plugin:fs|metadata', { path });
      if (stats.isDir) {
        await invoke('plugin:fs|remove_dir', { 
          path,
          options: { ...options, recursive: true }
        });
      } else {
        await invoke('plugin:fs|remove_file', { path });
      }
    } catch (error) {
      throw this.handleError(error, 'Failed to delete path');
    }
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      await invoke('plugin:fs|rename', { from: oldPath, to: newPath });
    } catch (error) {
      throw this.handleError(error, 'Failed to rename path');
    }
  }

  async copyFile(source: string, destination: string): Promise<void> {
    try {
      await invoke('plugin:fs|copy_file', { from: source, to: destination });
    } catch (error) {
      throw this.handleError(error, 'Failed to copy file');
    }
  }

  async metadata(path: string): Promise<FileMetadata> {
    try {
      return await invoke<FileMetadata>('plugin:fs|metadata', { path });
    } catch (error) {
      throw this.handleError(error, 'Failed to get file metadata');
    }
  }

  async watch(path: string, events: FileSystemEvents): Promise<() => void> {
    try {
      // Using Tauri's event system for file watching
      const unlistenFn = await invoke<UnlistenFn>('plugin:fs|watch', {
        path,
        handler: (event: { type: string; path: string }) => {
          const eventType = this.mapWatchEventType(event.type);
          if (eventType) {
            events.onChange(event.path, eventType);
          }
        }
      });

      this.watchHandlers.set(path, unlistenFn);
      
      return async () => {
        const unlistenFn = this.watchHandlers.get(path);
        if (unlistenFn) {
          await unlistenFn();
          this.watchHandlers.delete(path);
        }
      };
    } catch (error) {
      const fsError = this.handleError(error, 'Failed to watch path');
      events.onError(fsError);
      return () => Promise.resolve();
    }
  }

  private mapWatchEventType(type: string): 'create' | 'modify' | 'delete' | undefined {
    const eventMap: Record<string, 'create' | 'modify' | 'delete'> = {
      'create': 'create',
      'modify': 'modify',
      'remove': 'delete',
      'rename': 'modify'
    };
    return eventMap[type.toLowerCase()];
  }

  private handleError(error: unknown, defaultMessage: string): FileSystemError {
    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message
      };
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: defaultMessage
    };
  }
}