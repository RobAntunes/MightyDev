// File: src/components/AINativeIDE.tsx

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  MessageSquare,
  Code2,
  MonitorPlay,
  Maximize2,
  Minimize2,
  BrainCircuit,
  TerminalIcon,
} from "lucide-react";
import ResizablePanel from "./components/ResizablePanel";
import FileBrowser from "./components/FileBrowser"; // IntegratedFileBrowser
import FloatingActionBar from "./components/FloatingActionBar";
import "./global.css";
import ChatWorkspace from "./components/ChatWorkspace";
import IDEWorkspace from "./components/IDEWorkspace";
import TerminalManager from "./components/Terminal";

const AINativeIDE: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeMode, setActiveMode] = useState<"natural" | "technical">("natural");
  const [activeView, setActiveView] = useState<"code" | "preview">("code");
  const [aiContext, setAiContext] = useState<string>("");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [currentCode, setCurrentCode] = useState<string>("");

  // Panel visibility states
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true); // FileBrowser
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);

  // Terminal size state
  const [terminalSize, setTerminalSize] = useState<{ width: number; height: number }>({
    width: 400,
    height: 0,
  }); // Initial collapsed state

  // Define constants
  const TERMINAL_MIN_SIZE = { width: 400, height: 0 }; // Collapsed
  const TERMINAL_DEFAULT_SIZE = { width: 400, height: 400 }; // Expanded to 400px height

  const handlePreviewUpdate = (content: string) => {
    setPreviewContent(content);
    if (activeView !== "preview") {
      setActiveView("preview");
    }
  };

  const handleCodeUpdate = (content: string) => {
    setCurrentCode(content);
    if (activeMode !== "technical") {
      setActiveMode("technical");
    }
  };

  // Toggle terminal expansion
  const toggleTerminal = () => {
    setTerminalSize((prevSize) =>
      prevSize.height === TERMINAL_MIN_SIZE.height ? TERMINAL_DEFAULT_SIZE : TERMINAL_MIN_SIZE
    );
  };

  // Optional: Ensure terminal is fully collapsed when main component unmounts
  useEffect(() => {
    return () => {
      setTerminalSize(TERMINAL_MIN_SIZE);
    };
  }, []);

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
          {isMaximized ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">


        {/* Mode Switch Panel */}
        <div className="w-16 bg-zinc-900/80 backdrop-blur-md border-r border-zinc-800/50 flex flex-col items-center py-4 space-y-6">
          <button
            className={`p-3 rounded-lg transition-all duration-200 ${activeMode === "natural"
              ? "bg-lime-500/90 text-white"
              : "text-zinc-500 hover:bg-zinc-800/50"
              }`}
            onClick={() => setActiveMode("natural")}
            aria-label="Natural Mode"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
          <button
            className={`p-3 rounded-lg transition-all duration-200 ${activeMode === "technical"
              ? "bg-lime-500/90 text-white"
              : "text-zinc-500 hover:bg-zinc-800/50"
              }`}
            onClick={() => setActiveMode("technical")}
            aria-label="Technical Mode"
          >
            <Code2 className="w-6 h-6" />
          </button>
          <button
            className={`p-3 rounded-lg transition-all duration-200 ${activeView === "preview"
              ? "bg-lime-500/90 text-white"
              : "text-zinc-500 hover:bg-zinc-800/50"
              }`}
            onClick={() =>
              setActiveView((prev) => (prev === "preview" ? "code" : "preview"))
            }
            aria-label="Toggle Preview"
          >
            <MonitorPlay className="w-6 h-6" />
          </button>
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor/Content Area */}
          <div
            className={`flex-1 ${isBottomPanelVisible ? "border-b border-zinc-800/50" : ""
              } overflow-auto`}
          >
            {activeView === "preview" ? (
              <div className="flex-1 bg-zinc-900/80 backdrop-blur-md overflow-auto flex items-center justify-center text-zinc-500">
                {previewContent ? (
                  <div className="p-4">{previewContent}</div>
                ) : (
                  <span className="text-sm">Preview Mode</span>
                )}
              </div>
            ) : activeMode === "natural" ? (
              <div className="h-full flex-1 bg-zinc-900/80 backdrop-blur-md overflow-auto">
                <ChatWorkspace
                  onPreviewUpdate={handlePreviewUpdate}
                  onCodeUpdate={handleCodeUpdate}
                />
              </div>
            ) : (
              <div className="bg-zinc-900/80 backdrop-blur-md p-4 h-full overflow-auto">
                <IDEWorkspace />
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
                  aria-label={terminalSize.height > TERMINAL_MIN_SIZE.height ? "Minimize Terminal" : "Open Terminal"}
                >
                  {terminalSize.height > TERMINAL_MIN_SIZE.height ? (
                    <Minimize2 className="w-6 h-6 text-zinc-300" />
                  ) : (
                    <TerminalIcon className="w-6 h-6 text-zinc-300" />
                  )}
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
              <h2 className="text-lg font-light text-zinc-300 mb-4">Context</h2>
              {/* Context information */}
            </div>
          </ResizablePanel>
        )}
      </div>

      {/* Floating Action Bar */}
      <FloatingActionBar
        onToggleLeftPanel={() => setIsLeftPanelVisible(!isLeftPanelVisible)}
        onToggleRightPanel={() => setIsRightPanelVisible(!isRightPanelVisible)}
        onToggleBottomPanel={() => setIsBottomPanelVisible(!isBottomPanelVisible)}
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