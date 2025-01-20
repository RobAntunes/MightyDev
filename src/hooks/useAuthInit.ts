import { getAccessToken } from "../lib/auth";
import { Auth0ContextInterface, User } from "@auth0/auth0-react";
import { useState, useEffect } from "react";

export function useAuthSetup(auth0: Auth0ContextInterface<User>) {
    const { isLoading, isAuthenticated, loginWithRedirect } = auth0;
    const [isInitialized, setIsInitialized] = useState(false);
  
    useEffect(() => {
      let mounted = true;
  
      const initAuth = async () => {
        try {
          // Skip if still loading or already initialized
          if (isLoading || !mounted) return;
  
          // If not authenticated, store path and redirect
          if (!isAuthenticated) {
            const currentPath = window.location.pathname;
            if (currentPath !== '/login') {
              sessionStorage.setItem("returnPath", currentPath);
              await loginWithRedirect();
            }
            return;
          }
  
          // Get initial token
          await getAccessToken(auth0);
          
          if (mounted) {
            setIsInitialized(true);
          }
        } catch (error) {
          console.error("Auth initialization error:", error);
          if (mounted) {
            setIsInitialized(false);
          }
        }
      };
  
      initAuth();
  
      return () => {
        mounted = false;
      };
    }, [isLoading, isAuthenticated, auth0]);
  
    return {
      isInitialized,
      isLoading: isLoading || (!isInitialized && isAuthenticated)
    };
  }