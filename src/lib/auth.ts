// src/lib/auth.ts

import { Auth0ContextInterface, User } from "@auth0/auth0-react";
import { invoke } from "@tauri-apps/api/core";

interface TokenResponse {
  accessToken: string;
  expiresAt: number;
}

// Add a token cache to prevent unnecessary refreshes
let tokenCache: TokenResponse | null = null;

export const getAccessToken = async (
  auth0: Auth0ContextInterface<User>
): Promise<TokenResponse> => {
  try {
    // Check cache first
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
      return tokenCache;
    }

    if (!auth0.isAuthenticated) {
      throw new Error('User is not authenticated');
    }

    const token = await auth0.getAccessTokenSilently({
      authorizationParams: {
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email offline_access read:projects write:projects",
      },
      cacheMode: "on-demand" // Force fresh token check
    });

    // Calculate token expiration (Auth0 tokens typically expire in 24 hours)
    const expiresAt = Date.now() + 23 * 60 * 60 * 1000; // 23 hours to be safe

    // Store token with expiration (convert to Unix timestamp)
    await invoke('store_auth_token', { 
      token,
      expiresAt: Math.floor(expiresAt / 1000) // Convert to seconds
    });

    tokenCache = {
      accessToken: token,
      expiresAt
    };
    
    return tokenCache;
  } catch (error) {
    console.error("Error getting token:", error);
    throw error;
  }
};

export const invokeWithAuth = async (
  command: string,
  args?: Record<string, unknown>,
  auth0?: Auth0ContextInterface<User>
): Promise<any> => {
  try {
    if (auth0) {
      // Get fresh token
      const { accessToken } = await getAccessToken(auth0);
      return await invoke(command, {
        ...args,
        authToken: accessToken
      });
    }
    
    // Check if we have a valid token stored
    const hasToken = await invoke('has_auth_token');
    if (!hasToken) {
      throw new Error('No authentication token available');
    }

    return await invoke(command, args);
  } catch (error) {
    if (error instanceof Error && error.message.includes('403')) {
      // Token might be expired or invalid, force a new token fetch if auth0 is available
      if (auth0) {
        auth0.getAccessTokenSilently({ cacheMode: "no-cache" });
      }
    }
    console.error(`Error invoking ${command}:`, error);
    throw error;
  }
};