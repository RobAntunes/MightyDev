// src/services/context/fileOperations.ts

import { invokeWithAuth } from "../../lib/auth";
import { FSFileMetadata } from "../../types/filesystem";
import { Auth0ContextInterface } from "@auth0/auth0-react";

export interface FileOperationsService {
  readFile(path: string, auth0: Auth0ContextInterface): Promise<string>;
  writeFile(
    path: string,
    content: string,
    auth0: Auth0ContextInterface,
  ): Promise<void>;
  addToContext(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<FSFileMetadata>;
  removeFromContext(path: string, auth0: Auth0ContextInterface): Promise<void>;
  isFileInContext(path: string, auth0: Auth0ContextInterface): Promise<boolean>;
}

class TauriFileOperations implements FileOperationsService {
  public async readFile(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<string> {
    try {
      return await invokeWithAuth("read_file", { path }, auth0);
    } catch (error) {
      console.error("Error reading file:", error);
      throw new Error(`Failed to read file: ${error}`);
    }
  }

  public async writeFile(
    path: string,
    content: string,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    try {
      await invokeWithAuth("write_file", { path, content }, auth0);
    } catch (error) {
      console.error("Error writing file:", error);
      throw new Error(`Failed to write file: ${error}`);
    }
  }

  public async addToContext(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<FSFileMetadata> {
    try {
      // First read the file content
      const content = await this.readFile(path, auth0);

      // Then add to context system
      return await invokeWithAuth("add_to_context", {
        path,
        content,
      }, auth0);
    } catch (error) {
      console.error("Error adding file to context:", error);
      throw new Error(`Failed to add file to context: ${error}`);
    }
  }

  public async removeFromContext(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<void> {
    try {
      await invokeWithAuth("remove_from_context", { path }, auth0);
    } catch (error) {
      console.error("Error removing file from context:", error);
      throw new Error(`Failed to remove file from context: ${error}`);
    }
  }

  public async isFileInContext(
    path: string,
    auth0: Auth0ContextInterface,
  ): Promise<boolean> {
    try {
      return await invokeWithAuth("is_file_in_context", { path }, auth0);
    } catch (error) {
      console.error("Error checking file context:", error);
      throw new Error(`Failed to check file context: ${error}`);
    }
  }
}

// Export singleton instance
export const fileOperations = new TauriFileOperations();
