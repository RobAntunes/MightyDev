import React, { useState } from "react";
import {
  Sparkles,
  MessageSquare,
  Code2,
  MonitorPlay,
  Maximize2,
  Minimize2,
  BrainCircuit,
  Terminal,
  TerminalIcon,
} from "lucide-react";
import ResizablePanel from "./components/ResizablePanel";
import FileBrowser from "./components/FileBrowser";
import FloatingActionBar from "./components/FloatingActionBar";
import "./global.css";
import ChatWorkspace from "./components/ChatWorkspace";
import IDEWorkspace from "./components/IDEWorkspace";
import MonacoEditor from "./components/MonacoEditor";
import TerminalManager from "./components/Terminal";

const AINativeIDE = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [activeMode, setActiveMode] = useState("natural");
  const [activeView, setActiveView] = useState("code");
  const [aiContext, setAiContext] = useState("");
  const [previewContent, setPreviewContent] = useState<string>("");
  const [currentCode, setCurrentCode] = useState<string>("");

  // Panel visibility states
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(true);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(true);
  const [isBottomPanelVisible, setIsBottomPanelVisible] = useState(true);

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

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col">
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
        <button className="p-2 hover:bg-zinc-800/50 rounded-lg transition-all duration-200">
          {isMaximized ? (
            <Minimize2
              className="w-4 h-4"
              onClick={() => setIsMaximized(false)}
            />
          ) : (
            <Maximize2
              className="w-4 h-4"
              onClick={() => setIsMaximized(true)}
            />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Mode Switch Panel */}
        <div className="w-16 bg-zinc-900/80 backdrop-blur-md border-r border-zinc-800/50 flex flex-col items-center py-4 space-y-6">
          <button
            className={`p-3 rounded-lg transition-all duration-200 ${
              activeMode === "natural"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() => setActiveMode("natural")}
          >
            <MessageSquare className="w-6 h-6" />
          </button>
          <button
            className={`p-3 rounded-lg transition-all duration-200 ${
              activeMode === "technical"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() => setActiveMode("technical")}
          >
            <Code2 className="w-6 h-6" />
          </button>
          <button
            className={`p-3 rounded-lg transition-all duration-200 ${
              activeView === "preview"
                ? "bg-lime-500/90 text-white"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            onClick={() =>
              setActiveView((prev) => (prev === "preview" ? "code" : "preview"))
            }
          >
            <MonitorPlay className="w-6 h-6" />
          </button>
        </div>

        {/* Dynamic Content Area with Resizable Panels */}
        <div className="flex-1 flex">
          {/* Main Content Panel */}
          <div className="flex-1 flex flex-col">
            {/* Editor/Content Area */}
            <div
              className={`flex-1 ${
                isBottomPanelVisible ? "border-b border-zinc-800/50" : ""
              }`}
            >
              {activeView === "preview" ? (
                <div className="flex-1 bg-zinc-900/80 backdrop-blur-md">
                  <div className="h-full flex items-center justify-center text-zinc-500">
                    {previewContent ? (
                      <div className="p-4">{previewContent}</div>
                    ) : (
                      <span className="text-sm">Preview Mode</span>
                    )}
                  </div>
                </div>
              ) : activeMode === "natural" ? (
                <div className="flex-1 bg-zinc-900/80 backdrop-blur-md h-full">
                  <ChatWorkspace
                    onPreviewUpdate={handlePreviewUpdate}
                    onCodeUpdate={handleCodeUpdate}
                  />
                </div>
              ) : (
                <div className="flex-1 bg-zinc-900/80 backdrop-blur-md p-4 h-full">
                  <IDEWorkspace />
                </div>
              )}
            </div>

            {/* Bottom Panel */}
            {isBottomPanelVisible && (
              <ResizablePanel
                defaultSize={40}
                minSize={40}
                maxSize={300}
                collapseDirection="top"
                direction="vertical"
              >
                <div className="bg-zinc-900/80 backdrop-blur-md h-full">
                  <TerminalManager />
                </div>
              </ResizablePanel>
            )}
          </div>

          {/* Right Panel - Context/Help */}
          {isRightPanelVisible && (
            <ResizablePanel
              defaultSize={300}
              minSize={200}
              maxSize={500}
              direction="horizontal"
              className="border-l border-zinc-800/50"
            >
              <div className="h-full bg-zinc-900/80 backdrop-blur-md p-4">
                <h2 className="text-lg font-light text-zinc-300 mb-4">
                  Context
                </h2>
                {/* Context information */}
              </div>
            </ResizablePanel>
          )}
        </div>
      </div>

      {/* Floating Action Bar */}
      <FloatingActionBar
        onToggleLeftPanel={() => setIsLeftPanelVisible(!isLeftPanelVisible)}
        onToggleRightPanel={() => setIsRightPanelVisible(!isRightPanelVisible)}
        onToggleBottomPanel={() =>
          setIsBottomPanelVisible(!isBottomPanelVisible)
        }
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
