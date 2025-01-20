import React, { useState } from "react";
import {
  PanelLeftClose,
  PanelRightClose,
  PanelBottomClose,
  Layout,
  LayoutGrid,
  X,
} from "lucide-react";

const FloatingActionBar = ({
  onToggleLeftPanel,
  onToggleRightPanel,
  onToggleBottomPanel,
  isLeftPanelVisible,
  isRightPanelVisible,
  isBottomPanelVisible,
}: any) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="fixed z-[50] bottom-8 right-8 flex flex-col items-end space-y-2">
      {/* Expanded Menu */}
      {isExpanded && (
        <div className="flex flex-col items-center space-y-2 mb-2 bg-zinc-900/90 backdrop-blur-md p-2 rounded-lg border border-zinc-800/50">
          <button
            onClick={onToggleLeftPanel}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isLeftPanelVisible
                ? "bg-lime-500/20 text-lime-400"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            title="Toggle Left Panel"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleRightPanel}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isRightPanelVisible
                ? "bg-lime-500/20 text-lime-400"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            title="Toggle Right Panel"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleBottomPanel}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isBottomPanelVisible
                ? "bg-lime-500/20 text-lime-400"
                : "text-zinc-500 hover:bg-zinc-800/50"
            }`}
            title="Toggle Bottom Panel"
          >
            <PanelBottomClose className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3 bg-lime-500 hover:bg-lime-600 rounded-full text-white shadow-lg transition-all duration-200"
      >
        {isExpanded ? (
          <X className="w-5 h-5" />
        ) : (
          <LayoutGrid className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

export default FloatingActionBar;
