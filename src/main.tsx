import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";
import { BrowserRouter, Route, Routes } from "react-router";

import { eventSystem } from "./classes/events/EventSystem";
import { startAIRequestHandler } from "./handlers/ai";

// Custom history to handle redirects
const onRedirectCallback = (appState: any) => {
  window.history.replaceState(
    {},
    document.title,
    appState?.returnTo || window.location.pathname
  );
};

// 1) Initialize Event System here (once).
eventSystem.initialize({
  region: import.meta.env.VITE_AWS_REGION || "eu-west-3",
  eventBusName: import.meta.env.VITE_EVENT_BUS_NAME || "Main",
  mode: "hybrid",
  awsTopics: ["connection.created", "connection.deleted"],
})

// 2) Now start your AI request handler 
//    (it will call eventSystem.getEventBus() under the hood).
startAIRequestHandler().catch((err) => {
  console.error("Failed to start AI Request Handler:", err);
});

// 3) Render the app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
      onRedirectCallback={onRedirectCallback}
      cacheLocation="localstorage"
      useRefreshTokens={true}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
        </Routes>
      </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>
);