// File: src/components/ResizablePanel.tsx

import React, { useState, useRef, useEffect, ReactNode } from 'react';

type Direction = 'vertical' | 'horizontal' | 'both';

interface ResizablePanelProps {
  initialWidth?: number; // For horizontal resizing
  initialHeight?: number; // For vertical resizing
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  direction: Direction;
  children: ReactNode;
  className?: string;
  position: 'left' | 'right' | 'top' | 'bottom';
}

// File: src/components/ResizablePanel.tsx

const ResizablePanel: React.FC<ResizablePanelProps> = ({
    initialWidth = 300,
    initialHeight = 200,
    minWidth = 200,
    minHeight = 100,
    maxWidth = 800,
    maxHeight = 600,
    direction,
    position,
    children,
    className = '',
  }) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ width: number; height: number }>({
      width: initialWidth,
      height: initialHeight,
    });
    const [isResizing, setIsResizing] = useState<boolean>(false);
    const [resizeDirection, setResizeDirection] = useState<Direction>('both');
  
    const startResizing = (e: React.MouseEvent, dir: Direction) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeDirection(dir);
    };
  
    const stopResizing = () => {
      setIsResizing(false);
    };
  
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
  
      const rect = panelRef.current.getBoundingClientRect();
      let newWidth = size.width;
      let newHeight = size.height;
  
      // Adjust resizing logic based on position
      switch (position) {
        case 'left':
          if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
            newWidth = e.clientX - rect.left;
            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          }
          if (resizeDirection === 'vertical' || resizeDirection === 'both') {
            newHeight = e.clientY - rect.top;
            newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
          }
          break;
        case 'right':
          if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
            // For right panels, resizing left decreases width, resizing right increases width
            newWidth = rect.right - e.clientX;
            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          }
          if (resizeDirection === 'vertical' || resizeDirection === 'both') {
            newHeight = e.clientY - rect.top;
            newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
          }
          break;
        case 'top':
          if (resizeDirection === 'vertical' || resizeDirection === 'both') {
            newHeight = e.clientY - rect.top;
            newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
          }
          if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
            newWidth = e.clientX - rect.left;
            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          }
          break;
        case 'bottom':
          if (resizeDirection === 'vertical' || resizeDirection === 'both') {
            newHeight = rect.bottom - e.clientY;
            newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
          }
          if (resizeDirection === 'horizontal' || resizeDirection === 'both') {
            newWidth = e.clientX - rect.left;
            newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
          }
          break;
        default:
          break;
      }
  
      setSize({
        width: newWidth,
        height: newHeight,
      });
    };
  
    useEffect(() => {
      if (isResizing) {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', stopResizing);
        // Prevent text selection during resizing
        document.body.style.userSelect = 'none';
      } else {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopResizing);
        document.body.style.userSelect = 'auto';
      }
  
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', stopResizing);
        document.body.style.userSelect = 'auto';
      };
    }, [isResizing, handleMouseMove]);
  
    // Determine which handles to show based on position and direction
    const renderHandles = () => {
      const handles = [];
  
      // Handle for horizontal resizing
      if (direction === 'horizontal' || direction === 'both') {
        let handleClass = '';
        let ariaLabel = '';
        let dir: Direction = 'horizontal';
  
        if (position === 'left') {
          handleClass = 'right-0 top-0 bottom-0 w-2 cursor-ew-resize';
          ariaLabel = 'Resize Right';
        } else if (position === 'right') {
          handleClass = 'left-0 top-0 bottom-0 w-2 cursor-ew-resize';
          ariaLabel = 'Resize Left';
        } else if (position === 'top' || position === 'bottom') {
          handleClass = 'right-0 left-0 h-2 cursor-ew-resize';
          ariaLabel = 'Resize Horizontal';
        }
  
        handles.push(
          <div
            key={`resize-h-${position}`}
            onMouseDown={(e) => startResizing(e, 'horizontal')}
            className={`absolute ${handleClass} bg-transparent z-10`}
            aria-label={ariaLabel}
            role="separator"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const delta = e.key === 'ArrowLeft' ? -10 : 10;
                setSize((prev) => ({
                  ...prev,
                  width: Math.max(minWidth, Math.min(prev.width + delta, maxWidth)),
                }));
              }
            }}
          ></div>
        );
      }
  
      // Handle for vertical resizing
      if (direction === 'vertical' || direction === 'both') {
        let handleClass = '';
        let ariaLabel = '';
        let dir: Direction = 'vertical';
  
        if (position === 'top') {
          handleClass = 'bottom-0 left-0 right-0 h-2 cursor-ns-resize';
          ariaLabel = 'Resize Down';
        } else if (position === 'bottom') {
          handleClass = 'top-0 left-0 right-0 h-2 cursor-ns-resize';
          ariaLabel = 'Resize Up';
        } else if (position === 'left' || position === 'right') {
          handleClass = 'bottom-0 top-0 h-2 cursor-ns-resize';
          ariaLabel = 'Resize Vertical';
        }
  
        handles.push(
          <div
            key={`resize-v-${position}`}
            onMouseDown={(e) => startResizing(e, 'vertical')}
            className={`absolute ${handleClass} bg-transparent z-10`}
            aria-label={ariaLabel}
            role="separator"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const delta = e.key === 'ArrowUp' ? -10 : 10;
                setSize((prev) => ({
                  ...prev,
                  height: Math.max(minHeight, Math.min(prev.height + delta, maxHeight)),
                }));
              }
            }}
          ></div>
        );
      }
  
      // Handle for both-axis resizing (corner)
      if (direction === 'both') {
        let handleClass = '';
        let ariaLabel = '';
  
        switch (position) {
          case 'left':
            handleClass = 'right-0 bottom-0 w-4 h-4 cursor-se-resize';
            ariaLabel = 'Resize Southeast';
            break;
          case 'right':
            handleClass = 'left-0 bottom-0 w-4 h-4 cursor-se-resize';
            ariaLabel = 'Resize Southwest';
            break;
          case 'top':
            handleClass = 'right-0 bottom-0 w-4 h-4 cursor-se-resize';
            ariaLabel = 'Resize Southeast';
            break;
          case 'bottom':
            handleClass = 'right-0 top-0 w-4 h-4 cursor-se-resize';
            ariaLabel = 'Resize Northeast';
            break;
          default:
            handleClass = 'right-0 bottom-0 w-4 h-4 cursor-se-resize';
            ariaLabel = 'Resize Southeast';
        }
  
        handles.push(
          <div
            key={`resize-corner-${position}`}
            onMouseDown={(e) => startResizing(e, 'both')}
            className={`absolute ${handleClass} bg-transparent z-20`}
            aria-label={ariaLabel}
            role="separator"
            tabIndex={0}
            onKeyDown={(e) => {
              if (
                e.key === 'ArrowUp' ||
                e.key === 'ArrowDown' ||
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight'
              ) {
                e.preventDefault();
                const delta = e.key.startsWith('ArrowUp') || e.key.startsWith('ArrowLeft') ? -10 : 10;
                setSize((prev) => ({
                  width: Math.max(minWidth, Math.min(prev.width + delta, maxWidth)),
                  height: Math.max(minHeight, Math.min(prev.height + delta, maxHeight)),
                }));
              }
            }}
          >
            {/* Optional: Visual Indicator for Corner */}
            <div className="w-full h-full border-t border-l border-zinc-500"></div>
          </div>
        );
      }
  
      return handles;
    };
  
    return (
      <div
        ref={panelRef}
        className={`relative bg-zinc-800 text-white overflow-hidden ${className}`}
        style={{
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {children}
        {/* Render Resize Handles */}
        {renderHandles()}
      </div>
    );
  };
  
  export default ResizablePanel;