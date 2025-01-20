import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/AINativeIDE";
import { Auth0Provider } from "@auth0/auth0-react";
import { BrowserRouter } from "react-router";
import { SystemInitializer } from "./services/init";

const onRedirectCallback = (appState: any) => {
  const returnPath = appState?.returnTo || window.location.pathname;
  window.history.replaceState({}, document.title, returnPath);
};

await SystemInitializer.getInstance({ "maxRetries": 3, "retryDelay": 3000 })
  .initialize();

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
        <App />
      </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>,
);
