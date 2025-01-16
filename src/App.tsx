// File: src/components/AINativeIDE.tsx

import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Code2,
  LucideEye,
  Maximize2,
  MessageSquare,
  Minimize2,
  MonitorPlay,
  Sparkles,
  TerminalIcon,
  TestTube,
  Waypoints,
} from "lucide-react";
import ResizablePanel from "./components/ResizablePanel";
import FloatingActionBar from "./components/FloatingActionBar";
import IDEWorkspace from "./components/IDEWorkspace";
import TerminalManager from "./components/Terminal";
import { useAuth0 } from "@auth0/auth0-react";
import "./global.css";
import EventUI from "./components/EventUI";
import { createEventBus } from "./classes/events/eventBus";
import ChatWorkspace from "./components/ChatWorkspace";
import StorageTest from "./components/test";

const eventBus = createEventBus({
  "eventBusName": "main",
  "region": "eu-west-3",
  "mode": "hybrid",
});

const AINativeIDE: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeMode, setActiveMode] = useState<
    "natural" | "technical" | "events" | "test"
  >(
    "natural",
  );
  const [activeView, setActiveView] = useState<"code" | "preview">("code");
  const [aiContext, setAiContext] = useState<string>("");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [hasToken, setHasToken] = useState(false);

  // Panel visibility states
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true); // FileBrowser
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);

  // Terminal size state
  const [terminalSize, setTerminalSize] = useState<
    { width: number; height: number }
  >({
    width: 400,
    height: 0,
  }); // Initial collapsed state

  // Define constants
  const TERMINAL_MIN_SIZE = { width: 400, height: 0 }; // Collapsed
  const TERMINAL_DEFAULT_SIZE = { width: 400, height: 400 }; // Expanded to 400px height

  // Toggle terminal expansion
  const toggleTerminal = () => {
    setTerminalSize((prevSize) =>
      prevSize.height === TERMINAL_MIN_SIZE.height
        ? TERMINAL_DEFAULT_SIZE
        : TERMINAL_MIN_SIZE
    );
  };

  const {
    isLoading,
    isAuthenticated,
    loginWithRedirect,
    getAccessTokenSilently,
  } = useAuth0();

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (!isAuthenticated && !isLoading) {
          await loginWithRedirect();
        } else if (isAuthenticated) {
          const token = await getAccessTokenSilently({
            authorizationParams: {
              scope: "openid profile email",
            },
          });
          console.log("Access token retrieved successfully");
          setHasToken(true);
        }
      } catch (error) {
        console.error("Error authenticating user:", error);
      }
    };

    initAuth();

    return () => {
      setTerminalSize(TERMINAL_MIN_SIZE);
    };
  }, [isAuthenticated, isLoading, loginWithRedirect, getAccessTokenSilently]);

  if (isLoading || (isAuthenticated && !hasToken)) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-6 h-6 text-lime-400 animate-spin" />
          <span className="text-zinc-300">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <div className="h-12 bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-4 border-b border-zinc-800/50">
        <div className="flex items-center space-x-3">
          <BrainCircuit className="w-5 h-5 text-lime-400" />
          <span className="font-light">Mighty</span>
          <div className="h-4 w-px bg-zinc-800 mx-2" />
          <div className="flex items-center space-x-2 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
            <Sparkles className="w-4 h-4 text-lime-400" />
            <span className="text-sm font-light text-zinc-300">
              {aiContext || "I'm ready to help you build something amazing"}
            </span>
          </div>
        </div>
        <button
          className="p-2 hover:bg-zinc-800/50 rounded-lg transition-all duration-200"
          onClick={() => setIsMaximized(!isMaximized)}
          aria-label={isMaximized ? "Minimize Window" : "Maximize Window"}
        >
          {isMaximized
            ? <Minimize2 className="w-4 h-4" />
            : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Mode Switch Panel */}
        <div className="w-8 bg-zinc-900/80 backdrop-blur-md border-r border-zinc-800/50 flex flex-col items-center py-4">
          <button
            className={`w-8 py-4 pl-1.5 transition-all duration-200 ${
              activeMode === "natural"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() => setActiveMode("natural")}
            aria-label="Natural Mode"
          >
            <MessageSquare className="w-5 h-5" strokeWidth={1} />
          </button>
          <button
            className={`w-8 py-4 pl-1.5 transition-all duration-200 ${
              activeMode === "technical"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() => setActiveMode("technical")}
            aria-label="Technical Mode"
          >
            <Code2 className="w-5 h-5" strokeWidth={1} />
          </button>

          <button
            className={`w-8 py-4 pl-1.5 transition-all duration-200 ${
              activeMode === "events"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() => setActiveMode("events")}
            aria-label="Technical Mode"
          >
            <Waypoints className="w-5 h-5" strokeWidth={1} />
          </button>

          <button
            className={`w-8 py-4 pl-1.5 transition-all duration-200 ${
              activeMode === "test"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() => setActiveMode("test")}
            aria-label="Technical Mode"
          >
            <TestTube className="w-5 h-5" strokeWidth={1} />
          </button>

          <button
            className={`w-8 py-4 pl-1.5 border-t transition-all duration-200 ${
              activeView === "preview"
                ? "bg-lime-500/90 text-white/80"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() =>
              setActiveView((
                prev,
              ) => (prev === "preview" ? "code" : "preview"))}
            aria-label="Toggle Preview"
          >
            <MonitorPlay className="w-5 h-5" strokeWidth={1} />
          </button>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor/Content Area */}
          <div
            className={`flex-1 ${
              isBottomPanelVisible ? "border-b border-zinc-800/50" : ""
            } overflow-auto`}
          >
            {activeView === "preview"
              ? (
                <div className="flex-1 bg-zinc-900/80 backdrop-blur-md overflow-auto flex items-center justify-center text-zinc-500">
                  {previewContent
                    ? <div className="p-4">{previewContent}</div>
                    : <span className="text-sm">Preview Mode</span>}
                </div>
              )
              : activeMode === "natural"
              ? (
                <div className="h-full flex-1 bg-zinc-900/80 backdrop-blur-md overflow-auto">
                  <ChatWorkspace />
                </div>
              )
              : activeMode === "technical"
              ? (
                <div className="bg-zinc-900/80 backdrop-blur-md p-4 h-full overflow-auto">
                  <IDEWorkspace />
                </div>
              )
              : activeMode === "events"
              ? (
                <div className="bg-zinc-900/80 backdrop-blur-md p-4 h-full overflow-auto">
                  <EventUI eventBus={eventBus} />
                </div>
              )
              : (
                <div className="bg-zinc-900/80 backdrop-blur-md p-4 h-full overflow-auto">
                  <StorageTest />
                </div>
              )}
          </div>

          {/* Bottom Panel */}
          {isBottomPanelVisible && (
            <div className="flex flex-col">
              {/* Terminal Header */}
              <div className="bg-zinc-900/80 backdrop-blur-md border-t border-zinc-800/50 flex items-center justify-between px-4 h-8">
                <button
                  onClick={toggleTerminal}
                  className="focus:outline-none"
                  aria-label={terminalSize.height > TERMINAL_MIN_SIZE.height
                    ? "Minimize Terminal"
                    : "Open Terminal"}
                >
                  {terminalSize.height > TERMINAL_MIN_SIZE.height
                    ? <Minimize2 className="w-6 h-6 text-zinc-300" />
                    : <TerminalIcon className="w-6 h-6 text-zinc-300" />}
                </button>
              </div>
              {/* Terminal Panel */}
              {terminalSize.height > TERMINAL_MIN_SIZE.height && (
                <ResizablePanel
                  initialWidth={Infinity}
                  initialHeight={terminalSize.height}
                  minWidth={Infinity} // Ensures width doesn't go below 400px
                  minHeight={0} // Minimum height when expanded
                  maxWidth={Infinity} // Optional: set as needed
                  maxHeight={1200} // Optional: set as needed
                  position="bottom"
                  direction="vertical"
                  className="bg-zinc-900/80 backdrop-blur-md overflow-auto relative"
                >
                  <TerminalManager />
                </ResizablePanel>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Context/Help */}
        {isRightPanelVisible && (
          <ResizablePanel
            initialWidth={300}
            initialHeight={Infinity}
            minWidth={200}
            minHeight={Infinity}
            maxWidth={500}
            maxHeight={Infinity}
            position="right"
            direction="horizontal"
            className="flex flex-col bg-zinc-900/80 backdrop-blur-md border-l border-zinc-800/50"
          >
            <div className="h-full p-4 overflow-auto">
              <h2 className="text-lg font-light text-zinc-300 mb-4">
                Context
              </h2>
              {/* Context information */}
            </div>
          </ResizablePanel>
        )}
      </div>

      {/* Floating Action Bar */}
      <FloatingActionBar
        onToggleLeftPanel={() => setIsLeftPanelVisible(!isLeftPanelVisible)}
        onToggleRightPanel={() => setIsRightPanelVisible(!isRightPanelVisible)}
        onToggleBottomPanel={() =>
          setIsBottomPanelVisible(!isBottomPanelVisible)}
        isLeftPanelVisible={isLeftPanelVisible}
        isRightPanelVisible={isRightPanelVisible}
        isBottomPanelVisible={isBottomPanelVisible}
      />

      {/* Status Bar */}
      <div className="h-6 bg-zinc-900/80 backdrop-blur-md flex items-center px-4 text-xs font-light text-zinc-500 border-t border-zinc-800/50">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-lime-400" />
            AI Assistant Active
          </span>
          <span>Understanding project context and goals</span>
        </div>
      </div>
    </div>
  );
};

export default AINativeIDE;
