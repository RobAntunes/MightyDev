import React, { useCallback, useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "xterm/css/xterm.css";
import { invokeWithAuth } from "../lib/auth";
import { useAuth0 } from "@auth0/auth0-react";

interface TerminalManagerProps {
  className?: string;
  onStatusChange?: (status: TerminalStatus) => void;
}

interface TerminalSession {
  id: string;
  pid: number;
}

interface TerminalOutput {
  session_id: string;
  data: string;
}

type TerminalStatus = "initializing" | "ready" | "error" | "reconnecting";

const TERMINAL_CONFIG = {
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: 12,
  theme: {
    background: "#18181B",
    foreground: "#fafafa",
    cursor: "#84cc16",
    selection: "#3f3f46",
  },
  allowTransparency: true,
  scrollback: 10000,
  cursorBlink: true,
  cursorStyle: "block" as const,
  convertEol: true,
};

const TerminalManager: React.FC<TerminalManagerProps> = ({
  className = "",
  onStatusChange,
}) => {
  const [status, setStatus] = useState<TerminalStatus>("initializing");
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Refs for managing terminal state and cleanup
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const retryCountRef = useRef(0);
  const resizeTimeoutRef = useRef<number>(0);
  const mountedRef = useRef(true);
  const outputListenerRef = useRef<UnlistenFn | null>(null);
  const dataHandlerRef = useRef<{ dispose: () => void } | null>(null);

  const auth0 = useAuth0();

  const updateStatus = useCallback((newStatus: TerminalStatus) => {
    if (mountedRef.current) {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    }
  }, [onStatusChange]);

  const handleResize = useCallback(async (currentSessionId: string) => {
    if (!terminalRef.current || !currentSessionId) return;

    window.clearTimeout(resizeTimeoutRef.current);

    resizeTimeoutRef.current = window.setTimeout(() => {
      if (!fitAddonRef.current?.proposeDimensions()) return;

      const terminal = terminalRef.current;
      if (terminal?.element && terminal.cols && terminal.rows) {
        invokeWithAuth("resize_terminal", {
          sessionId: currentSessionId,
          cols: terminal.cols,
          rows: terminal.rows,
        }, auth0).catch(console.error);
      }
    }, 100);
  }, []);

  const initializeTerminal = useCallback(() => {
    if (!containerRef.current) return null;

    // Clean up any existing terminal
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }

    const wrapper = document.createElement("div");
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.padding = "10px";
    wrapper.style.backgroundColor = "transparent";
    wrapper.style.position = "relative";
    wrapper.style.minWidth = "640px";
    wrapper.style.minHeight = "384px";

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(wrapper);

    const terminal = new XTerm({
      ...TERMINAL_CONFIG,
      cols: 80,
      rows: 24,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());

    fitAddonRef.current = fitAddon;
    terminalRef.current = terminal;

    terminal.open(wrapper);

    try {
      fitAddon.fit();
    } catch (e) {
      console.warn("Initial fit failed:", e);
    }

    // Set up resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeoutRef.current) {
        window.clearTimeout(resizeTimeoutRef.current);
      }

      resizeTimeoutRef.current = window.setTimeout(() => {
        if (fitAddonRef.current && terminal.element) {
          try {
            if (fitAddonRef.current.proposeDimensions()) {
              fitAddonRef.current.fit();
              if (sessionId) {
                handleResize(sessionId);
              }
            }
          } catch (e) {
            console.warn("Fit operation failed:", e);
          }
        }
      }, 100);
    });

    resizeObserverRef.current = resizeObserver;
    resizeObserver.observe(wrapper);

    return terminal;
  }, [handleResize, sessionId]);

  const createSession = useCallback(async () => {
    try {
      const session = await invokeWithAuth(
        "create_terminal_session",
        {},
        auth0,
      );
      if (mountedRef.current) {
        setSessionId(session.id);
      }
      return session;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const setupTerminalEvents = useCallback(async (currentSessionId: string) => {
    if (!terminalRef.current || !currentSessionId) return;

    const terminal = terminalRef.current;

    // Clean up any existing handlers
    if (dataHandlerRef.current) {
      dataHandlerRef.current.dispose();
    }
    if (outputListenerRef.current) {
      await outputListenerRef.current();
    }

    // Set up new handlers
    dataHandlerRef.current = terminal.onData((data) => {
      if (currentSessionId) {
        invokeWithAuth("write_to_terminal", {
          sessionId: currentSessionId,
          data,
        }, auth0).catch(console.error);
      }
    });

    outputListenerRef.current = await listen<TerminalOutput>(
      "terminal-output",
      (event) => {
        if (event.payload.session_id === currentSessionId && terminal) {
          terminal.write(event.payload.data);
        }
      },
    );

    // Return cleanup function
    return async () => {
      if (dataHandlerRef.current) {
        dataHandlerRef.current.dispose();
        dataHandlerRef.current = null;
      }
      if (outputListenerRef.current) {
        await outputListenerRef.current();
        outputListenerRef.current = null;
      }
    };
  }, []);

  const cleanupTerminal = useCallback(
    async (currentSessionId: string | null) => {
      window.clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = 0;

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Clean up event handlers
      if (dataHandlerRef.current) {
        dataHandlerRef.current.dispose();
        dataHandlerRef.current = null;
      }
      if (outputListenerRef.current) {
        await outputListenerRef.current();
        outputListenerRef.current = null;
      }

      if (terminalRef.current) {
        terminalRef.current.dispose();
        terminalRef.current = null;
      }

      if (currentSessionId) {
        try {
          await invokeWithAuth("terminate_terminal_session", {
            sessionId: currentSessionId,
          }, auth0);
        } catch (err) {
          console.warn("Failed to terminate session:", err);
        }
        if (mountedRef.current) {
          setSessionId(null);
        }
      }

      fitAddonRef.current = null;
    },
    [],
  );

  const initializeSession = useCallback(async () => {
    try {
      updateStatus("initializing");
      const terminal = initializeTerminal();
      if (!terminal) throw new Error("Failed to initialize terminal");

      const session = await createSession();
      if (!session) throw new Error("Failed to create terminal session");

      const cleanup = await setupTerminalEvents(session.id);

      if (mountedRef.current) {
        updateStatus("ready");
        setError(null);
        retryCountRef.current = 0;
        return cleanup;
      } else {
        cleanup?.();
      }
    } catch (err) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        updateStatus("error");
      }
    }
  }, [createSession, initializeTerminal, setupTerminalEvents, updateStatus]);

  const handleRetry = useCallback(async () => {
    const maxRetries = 3;
    if (retrying || retryCountRef.current >= maxRetries) return;

    setRetrying(true);
    retryCountRef.current += 1;

    try {
      await cleanupTerminal(sessionId);
      await initializeSession();
    } finally {
      if (mountedRef.current) {
        setRetrying(false);
      }
    }
  }, [retrying, cleanupTerminal, initializeSession, sessionId]);

  // Initialize terminal and session on mount
  useEffect(() => {
    mountedRef.current = true;
    let cleanup: (() => void) | undefined;

    initializeSession().then((result) => {
      cleanup = result;
    });

    return () => {
      mountedRef.current = false;
      if (cleanup) cleanup();
      cleanupTerminal(sessionId);
    };
  }, []); // Empty dependency array to run only once

  return (
    <div className={`relative flex flex-col h-full ${className}`}>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-zinc-900/90 backdrop-blur-md border border-zinc-800/50"
      />

      {status === "error" && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>Terminal error: {error}</span>
            </div>
            {retryCountRef.current < 3 && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 
                         rounded-lg text-red-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${retrying ? "animate-spin" : ""}`}
                />
                <span>Retry Connection</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TerminalManager;
