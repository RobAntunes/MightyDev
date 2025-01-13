import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// Types for the terminal manager
interface TerminalManagerProps {
  className?: string;
  onStatusChange?: (status: TerminalStatus) => void;
}

interface TerminalSession {
  id: string;
  pid: number;
}

interface TerminalConfig {
  shell?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface TerminalOutputEvent {
  session_id: string;
  data: string;
}

interface TerminalErrorEvent {
  message: string;
}

type TerminalStatus = 'initializing' | 'ready' | 'error' | 'reconnecting';

const TerminalManager: React.FC<TerminalManagerProps> = ({ 
  className = '',
  onStatusChange 
}) => {
  const [status, setStatus] = useState<TerminalStatus>('initializing');
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const unlistenRef = useRef<UnlistenFn[]>([]);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  const updateStatus = useCallback((newStatus: TerminalStatus) => {
    setStatus(newStatus);
    onStatusChange?.(newStatus);
  }, [onStatusChange]);

  const cleanupTerminal = useCallback(async () => {
    // Cleanup event listeners
    for (const unlisten of unlistenRef.current) {
      await unlisten();
    }
    unlistenRef.current = [];

    // Cleanup terminal
    if (terminalRef.current) {
      terminalRef.current.dispose();
      terminalRef.current = null;
    }

    // Cleanup session
    if (sessionId) {
      try {
        await invoke('terminate_terminal_session', { sessionId });
      } catch (err) {
        console.warn('Failed to terminate session:', err);
      }
      setSessionId(null);
    }

    // Clear container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }
  }, [sessionId]);

  const initializeTerminal = useCallback(() => {
    if (!containerRef.current) return null;

    const xterm = new XTerm({
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      theme: {
        background: '#18181B',
        foreground: '#fafafa',
        cursor: '#84cc16',
        selection: '#3f3f46',
      },
      allowTransparency: true,
      scrollback: 10000,
      cursorBlink: true,
      cursorStyle: 'block',
      convertEol: true,
      windowOptions: {
        setWinLines: true
      },
      windowsMode: process.platform === 'win32'
    });

    // Add FitAddon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add WebLinksAddon
    xterm.loadAddon(new WebLinksAddon());

    terminalRef.current = xterm;

    // Create container with proper styling
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.padding = '10px';
    wrapper.style.backgroundColor = 'transparent';
    containerRef.current.appendChild(wrapper);

    xterm.open(wrapper);

    // Initial fit
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
        xterm.write('\x1b[1;32mTerminal initialized\x1b[0m\r\n\r\n');
      } catch (e) {
        console.error('Terminal fit failed:', e);
      }
    });

    return xterm;
  }, []);

  const createSession = useCallback(async (config?: TerminalConfig): Promise<TerminalSession> => {
    try {
      const session = await invoke<TerminalSession>('create_terminal_session', { config });
      return session;
    } catch (error) {
      throw new Error(`Failed to create terminal session: ${error}`);
    }
  }, []);

  const handleResize = useCallback(() => {
    if (fitAddonRef.current && terminalRef.current && sessionId) {
      try {
        fitAddonRef.current.fit();
        const terminal = terminalRef.current;
        
        if (terminal.cols && terminal.rows) {
          invoke('resize_terminal', {
            sessionId,
            cols: terminal.cols,
            rows: terminal.rows
          }).catch(console.error);
        }
      } catch (e) {
        console.error('Terminal resize failed:', e);
      }
    }
  }, [sessionId]);

  const setupTerminalEvents = useCallback(async () => {
    if (!terminalRef.current || !sessionId) return;

    const terminal = terminalRef.current;

    // Handle user input with proper buffering
    let inputBuffer = '';
    let inputTimeout: NodeJS.Timeout | null = null;

    terminal.onData((data) => {
      if (!sessionId) return;

      // Buffer the input
      inputBuffer += data;

      // Clear existing timeout
      if (inputTimeout) {
        clearTimeout(inputTimeout);
      }

      // Set new timeout to flush buffer
      inputTimeout = setTimeout(async () => {
        if (inputBuffer) {
          try {
            await invoke('write_to_terminal', {
              sessionId,
              data: inputBuffer
            });
          } catch (err) {
            console.error('Failed to write to terminal:', err);
          }
          inputBuffer = '';
        }
      }, 5); // 5ms buffer time
    });

    // Listen for terminal output
    const outputUnlisten = await listen<TerminalOutputEvent>('terminal-output', (event) => {
      if (event.payload.session_id === sessionId && terminal) {
        terminal.write(event.payload.data);
      }
    });

    // Listen for terminal errors
    const errorUnlisten = await listen<TerminalErrorEvent>('terminal-error', (event) => {
      console.error('Terminal error:', event.payload.message);
      setError(event.payload.message);
      updateStatus('error');
    });

    unlistenRef.current.push(outputUnlisten, errorUnlisten);
  }, [sessionId, updateStatus]);

  const retryInitialization = useCallback(async () => {
    if (retrying) return;
    
    setRetrying(true);
    retryCountRef.current += 1;
    
    try {
      await cleanupTerminal();
      updateStatus('reconnecting');
      
      const session = await createSession();
      setSessionId(session.id);
      
      const xterm = initializeTerminal();
      if (!xterm) throw new Error('Failed to initialize terminal');
      
      await setupTerminalEvents();
      
      updateStatus('ready');
      setError(null);
      retryCountRef.current = 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      updateStatus('error');
    } finally {
      setRetrying(false);
    }
  }, [cleanupTerminal, createSession, initializeTerminal, setupTerminalEvents, retrying, updateStatus]);

  // Initialize terminal and session
  useEffect(() => {
    const init = async () => {
      try {
        updateStatus('initializing');
        const session = await createSession();
        setSessionId(session.id);
        
        const xterm = initializeTerminal();
        if (!xterm) throw new Error('Failed to initialize terminal');
        
        await setupTerminalEvents();
        updateStatus('ready');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(errorMessage);
        updateStatus('error');
      }
    };

    init();

    return () => {
      cleanupTerminal().catch(console.error);
    };
  }, [createSession, initializeTerminal, setupTerminalEvents, cleanupTerminal, updateStatus]);

  // Handle window resize
  useEffect(() => {
    const debouncedResize = debounce(handleResize, 100);
    window.addEventListener('resize', debouncedResize);
    return () => window.removeEventListener('resize', debouncedResize);
  }, [handleResize]);

  return (
    <div className={`relative flex flex-col h-full ${className}`}>
      <div 
        ref={containerRef} 
        className="flex-1 overflow-hidden bg-zinc-900/90 backdrop-blur-md rounded-lg border border-zinc-800/50"
      />
      
      {status === 'error' && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <span>Terminal error: {error}</span>
            </div>
            {retryCountRef.current < maxRetries && (
              <button
                onClick={retryInitialization}
                disabled={retrying}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 
                         rounded-lg text-red-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                <span>Retry Connection</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default TerminalManager;