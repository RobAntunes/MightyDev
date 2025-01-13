import React, { useState, useRef, useEffect } from "react";

interface ResizablePanelProps {
  children: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  direction?: "horizontal" | "vertical";
  isCollapsible?: boolean;
  className?: string;
  collapseDirection?: "left" | "right" | "top" | "bottom";
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  defaultSize = 250,
  minSize = 48,
  maxSize,
  direction = "horizontal",
  isCollapsible = true,
  className = "",
  collapseDirection = "left",
}) => {
  const [size, setSize] = useState<number>(defaultSize);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previousSize = useRef<number>(defaultSize);

  const isHorizontal = direction === "horizontal";

  useEffect(() => {
    // Store original user-select value
    const originalUserSelect = document.body.style.userSelect;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const container = containerRef.current;
      if (!container) return;

      // Prevent text selection during resize
      document.body.style.userSelect = "none";

      const rect = container.getBoundingClientRect();
      let newSize: number;

      if (isHorizontal) {
        newSize =
          collapseDirection === "left"
            ? rect.right - e.clientX
            : e.clientX - rect.left;
      } else {
        newSize =
          collapseDirection === "top"
            ? rect.bottom - e.clientY
            : e.clientY - rect.top;
      }

      newSize = Math.max(minSize, Math.min(maxSize || 10000, newSize));
      setSize(newSize);

      // Prevent default dragging behavior
      e.preventDefault();
    };

    const handleMouseUp = () => {
      setIsDragging(false);

      // Restore original user-select values
      document.body.style.userSelect = originalUserSelect;
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Add cursor styles to body during drag
      document.body.style.cursor = isHorizontal ? "col-resize" : "row-resize";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      // Reset cursor
      document.body.style.cursor = "default";

      // Ensure we restore user-select on cleanup
      document.body.style.userSelect = originalUserSelect;
    };
  }, [isDragging, isHorizontal, maxSize, minSize, collapseDirection]);

  const handleCollapse = () => {
    if (isCollapsed) {
      setSize(previousSize.current);
    } else {
      previousSize.current = size;
      setSize(minSize);
    }
    setIsCollapsed(!isCollapsed);
  };

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault(); // Prevent text selection on initial click
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex ${
        isHorizontal ? "flex-row" : "flex-col"
      } ${className}`}
      style={{
        [isHorizontal ? "width" : "height"]: size,
        flexShrink: 0,
      }}
    >
      <div className="flex-1 overflow-hidden">{children}</div>

      <div
        className={`
          ${isHorizontal ? "w-[1px] cursor-col-resize" : "h-[1px] cursor-row-resize"}
          hover:bg-lime-500/20 active:bg-lime-500/40 transition-colors
          ${isDragging ? "bg-lime-500/40" : "bg-transparent"}
          ${
            isHorizontal
              ? collapseDirection === "left"
                ? "order-first"
                : "order-last"
              : collapseDirection === "top"
              ? "order-first"
              : "order-last"
          }
        `}
        onMouseDown={handleResizerMouseDown}
      />
    </div>
  );
};

export default ResizablePanel;
