// src/main.tsx
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/AINativeIDE";
import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { BrowserRouter } from "react-router";
import { SystemInitializer } from "./services/init";
import { createContext } from "react";
import { StorageService } from "./services/db/rocksdb";

export const StorageCtx = createContext({} as StorageService);

const AppInitializer: React.FC = () => {
  const [storage, setStorage] = useState<StorageService | null>(null);
  const auth0 = useAuth0();

  useEffect(() => {
    const initSystem = async () => {
      try {
        setStorage(StorageService.getInstance(auth0));
        await SystemInitializer.getInstance(auth0, {
          maxRetries: 3,
          retryDelay: 3000,
        }).initialize();
      } catch (error) {
        console.error("Failed to initialize system:", error);
      }
    };

    if (auth0.isAuthenticated) {
      initSystem();
    }
  }, [auth0.isAuthenticated]);

  return (
    <StorageCtx.Provider value={storage as StorageService}>
      <App />
    </StorageCtx.Provider>
  );
};

const onRedirectCallback = (appState: any) => {
  const returnPath = appState?.returnTo || window.location.pathname;
  window.history.replaceState({}, document.title, returnPath);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: "http://localhost:1420",
        scope:
          "openid profile email offline_access read:projects write:projects",
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <BrowserRouter>
        <AppInitializer />
      </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>,
);
