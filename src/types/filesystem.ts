import { invokeWithAuth } from "../lib/auth";
import { Auth0ContextInterface } from "@auth0/auth0-react";
import { UnlistenFn } from "@tauri-apps/api/event";

export interface FileSystemNode {
  id: string;
  name: string;
  type: "file" | "directory";
  path: string;
  metadata: FSFileMetadata;
  children?: FileSystemNode[];
}

export interface FSFileMetadata {
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
  onChange: (path: string, type: "create" | "modify" | "delete") => void;
  onError: (error: FileSystemError) => void;
}

export interface FileSystemOptions {
  recursive?: boolean;
  baseDir?: string;
}

export interface FileSystemOperations {
  readDirectory(
    path: string,
    auth0: Auth0ContextInterface,
    options?: FileSystemOptions,
  ): Promise<FileSystemNode[]>;
  readFile(path: string, auth0: Auth0ContextInterface): Promise<Uint8Array>;
  readTextFile(path: string, auth0: Auth0ContextInterface): Promise<string>;
  writeFile(
    path: string,
    data: Uint8Array,
    auth0: Auth0ContextInterface,
  ): Promise<void>;
  writeTextFile(
    path: string,
    contents: string,
    auth0: Auth0ContextInterface,
  ): Promise<void>;
  createDirectory(
    path: string,
    auth0: Auth0ContextInterface,
    options?: FileSystemOptions,
  ): Promise<void>;
  exists(path: string, auth0: Auth0ContextInterface): Promise<boolean>;
  delete(
    path: string,
    auth0: Auth0ContextInterface,
    options?: FileSystemOptions,
  ): Promise<void>;
  rename(
    oldPath: string,
    newPath: string,
    auth0: Auth0ContextInterface,
  ): Promise<void>;
  copyFile(
    source: string,
    destination: string,
    auth0: Auth0ContextInterface,
  ): Promise<void>;
  metadata(path: string, auth0: Auth0ContextInterface): Promise<FSFileMetadata>;
  watch(
    path: string,
    events: FileSystemEvents,
    auth0: Auth0ContextInterface,
  ): Promise<() => void>;
}

export class TauriFileSystem implements FileSystemOperations {
  private watchHandlers: Map<string, UnlistenFn> = new Map();

  async readDirectory(
    path: string,
    auth0: Auth0ContextInterface,
    options?: FileSystemOptions,
  ): Promise<FileSystemNode[]> {
    try {
      const entries = await invokeWithAuth(
        "plugin:fs|read_dir",
        {
          path,
          options,
        },
        auth0,
      );
      return entries;
    } catch (error) {
      throw this.handleError(error, "Failed to read directory");
    }
  }

  async readFile(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<Uint8Array> {
    try {
      const result = await invokeWithAuth(
        "plugin:fs|read_file",
        { path },
        auth0,
      );
      return new Uint8Array(result);
    } catch (error) {
      throw this.handleError(error, "Failed to read file");
    }
  }

  async readTextFile(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<string> {
    try {
      return await invokeWithAuth("plugin:fs|read_text_file", { path }, auth0);
    } catch (error) {
      throw this.handleError(error, "Failed to read text file");
    }
  }

  async writeFile(
    path: string,
    data: Uint8Array,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    try {
      await invokeWithAuth("plugin:fs|write_file", {
        path,
        data: Array.from(data),
      }, auth0);
    } catch (error) {
      throw this.handleError(error, "Failed to write file");
    }
  }

  async writeTextFile(
    path: string,
    contents: string,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    try {
      await invokeWithAuth(
        "plugin:fs|write_text_file",
        { path, contents },
        auth0,
      );
    } catch (error) {
      throw this.handleError(error, "Failed to write text file");
    }
  }

  async createDirectory(
    path: string,
    auth0: Auth0ContextInterface,
    options?: FileSystemOptions,
  ): Promise<void> {
    try {
      await invokeWithAuth("plugin:fs|create_dir", { path, options }, auth0);
    } catch (error) {
      throw this.handleError(error, "Failed to create directory");
    }
  }

  async exists(path: string, auth0: Auth0ContextInterface): Promise<boolean> {
    try {
      return await invokeWithAuth("plugin:fs|exists", { path }, auth0);
    } catch (error) {
      throw this.handleError(error, "Failed to check existence");
    }
  }

  async delete(
    path: string,
    auth0: Auth0ContextInterface,
    options?: FileSystemOptions,
  ): Promise<void> {
    try {
      // const metadata = await this.metadata(path, auth0);
      const stats = await invokeWithAuth("plugin:fs|metadata", {
        path,
      }, auth0);
      if (stats.isDir) {
        await invokeWithAuth("plugin:fs|remove_dir", {
          path,
          options: { ...options, recursive: true },
        }, auth0);
      } else {
        await invokeWithAuth("plugin:fs|remove_file", { path }, auth0);
      }
    } catch (error) {
      throw this.handleError(error, "Failed to delete path");
    }
  }

  async rename(
    oldPath: string,
    newPath: string,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    try {
      await invokeWithAuth(
        "plugin:fs|rename",
        { from: oldPath, to: newPath },
        auth0,
      );
    } catch (error) {
      throw this.handleError(error, "Failed to rename path");
    }
  }

  async copyFile(
    source: string,
    destination: string,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    try {
      await invokeWithAuth("plugin:fs|copy_file", {
        from: source,
        to: destination,
      }, auth0);
    } catch (error) {
      throw this.handleError(error, "Failed to copy file");
    }
  }

  async metadata(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<FSFileMetadata> {
    try {
      return await invokeWithAuth("plugin:fs|metadata", { path }, auth0);
    } catch (error) {
      throw this.handleError(error, "Failed to get file metadata");
    }
  }

  async watch(
    path: string,
    events: FileSystemEvents,
    auth0: Auth0ContextInterface,
  ): Promise<() => void> {
    try {
      // Using Tauri's event system for file watching
      const unlistenFn = await invokeWithAuth("plugin:fs|watch", {
        path,
        handler: (event: { type: string; path: string }) => {
          const eventType = this.mapWatchEventType(event.type);
          if (eventType) {
            events.onChange(event.path, eventType);
          }
        },
      }, auth0);

      this.watchHandlers.set(path, unlistenFn);

      return async () => {
        const unlistenFn = this.watchHandlers.get(path);
        if (unlistenFn) {
          unlistenFn();
          this.watchHandlers.delete(path);
        }
      };
    } catch (error) {
      const fsError = this.handleError(error, "Failed to watch path");
      events.onError(fsError);
      return () => Promise.resolve();
    }
  }

  private mapWatchEventType(
    type: string,
  ): "create" | "modify" | "delete" | undefined {
    const eventMap: Record<string, "create" | "modify" | "delete"> = {
      "create": "create",
      "modify": "modify",
      "remove": "delete",
      "rename": "modify",
    };
    return eventMap[type.toLowerCase()];
  }

  private handleError(error: unknown, defaultMessage: string): FileSystemError {
    if (error instanceof Error) {
      return {
        code: "UNKNOWN_ERROR",
        message: error.message,
      };
    }
    return {
      code: "UNKNOWN_ERROR",
      message: defaultMessage,
    };
  }
}
