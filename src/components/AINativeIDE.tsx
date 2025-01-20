import React, { useEffect, useState } from "react";
import {
  BrainCircuit,
  Code2,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  MonitorPlay,
  Sparkles,
  TestTube,
  Waypoints,
} from "lucide-react";
import { useAuth0 } from "@auth0/auth0-react";
import ResizablePanel from "./ResizablePanel";
import FloatingActionBar from "./FloatingActionBar";
import IDEWorkspace from "./IDEWorkspace";
import TerminalManager from "./Terminal";
import "../global.css";
import EventUI from "./EventUI";
import ChatWorkspace from "./ChatWorkspace";
import StorageTest from "./test";
import Context from "./Context";
import { eventSystem } from "../classes/events/manager";
import { useAuthSetup } from "../hooks/useAuthInit";
import { Storage } from "../services/db/rocksdb";

const AINativeIDE: React.FC = () => {
  const auth0 = useAuth0();
  const { isInitialized, isLoading } = useAuthSetup(auth0);

  // UI State Variables
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeMode, setActiveMode] = useState<
    "natural" | "technical" | "events" | "test"
  >("natural");
  const [activeView, setActiveView] = useState<"code" | "preview">("code");
  const [previewContent, setPreviewContent] = useState<string>("");

  // Panel Visibility States
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);

  // Terminal Size State
  const [terminalSize, setTerminalSize] = useState<
    { width: number; height: number }
  >({
    width: 400,
    height: 0,
  });

  // Define Constants for Terminal
  const TERMINAL_MIN_SIZE = { width: 400, height: 0 };
  const TERMINAL_DEFAULT_SIZE = { width: 400, height: 400 };

  // Toggle Terminal Expansion
  const toggleTerminal = () => {
    setTerminalSize((prevSize) =>
      prevSize.height === TERMINAL_MIN_SIZE.height
        ? TERMINAL_DEFAULT_SIZE
        : TERMINAL_MIN_SIZE
    );
  };

  useEffect(() => {
    try {
      // Initialize the StorageService with desired options
      Storage.initialize({
        retryAttempts: 5,
        retryDelay: 2000, // milliseconds
      });
      console.log("StorageService initialized successfully.");
    } catch (error) {
      console.error("Failed to initialize StorageService:", error);
      // Optionally, handle the error (e.g., show a notification to the user)
    }
  }, []);

  // Display Loading Indicator during auth or initialization
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
        <span className="ml-2 text-zinc-300">Loading...</span>
      </div>
    );
  }

  // Check authentication
  if (!auth0.isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-900">
        <div className="text-zinc-300">Authenticating...</div>
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
              I'm ready to help you build something amazing
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
            aria-label="Events Mode"
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
            aria-label="Test Mode"
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
                  <EventUI eventBus={eventSystem.getEventBus()} />
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
                    : <MonitorPlay className="w-6 h-6 text-zinc-300" />}
                </button>
              </div>
              {/* Terminal Panel */}
              {terminalSize.height > TERMINAL_MIN_SIZE.height && (
                <ResizablePanel
                  initialWidth={Infinity}
                  initialHeight={terminalSize.height}
                  minWidth={Infinity}
                  minHeight={0}
                  maxWidth={Infinity}
                  maxHeight={1200}
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
            <Context className="h-full" onContextUpdate={() => {}} />
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
