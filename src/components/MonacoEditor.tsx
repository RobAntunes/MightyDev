import React, { useRef, useEffect, useState } from 'react';
import Editor, { useMonaco, OnMount, Monaco } from '@monaco-editor/react';
import { Sparkles } from 'lucide-react';
import { registerAllLanguages } from '../languages';

interface MonacoEditorProps {
  path: string;
  content?: string;
  defaultLanguage?: string;
  theme?: 'light' | 'vs-dark';
  onChange?: (value: string | undefined) => void;
  onSave?: (content: string) => void;
  className?: string;
  options?: Record<string, unknown>;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  beforeMount?: (monaco: Monaco) => void;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({
  path,
  content,
  defaultLanguage = 'plaintext',
  theme = 'vs-dark',
  onChange,
  onSave,
  className = '',
  options = {},
  wrapperProps = {},
  beforeMount,
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isMounted = useRef<boolean>(true);

  // Handle language registration when Monaco is ready
  useEffect(() => {
    if (monaco) {
      registerAllLanguages(monaco);
    }
  }, [monaco]);

  // Handle editor setup
  const handleEditorWillMount = (monaco: Monaco) => {
    if (!isMounted.current) return;
    beforeMount?.(monaco);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    if (!isMounted.current) return;

    editorRef.current = editor;
    setIsLoading(false);

    // Editor configuration
    editor.updateOptions({
      fontSize: 12,
      fontFamily: 'MonoLisa, Menlo, Monaco, "Courier New", monospace',
      minimap: { enabled: true, scale: 0.75 },
      scrollbar: {
        useShadows: false,
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      padding: { top: 16, bottom: 16 },
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      links: true,
      contextmenu: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      ...options,
    });

    // Set up save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        const content = editor.getValue();
        onSave(content);
      }
    });

    // Set initial content
    if (content) {
      editor.setValue(content);
    }

    // Update language based on file extension
    updateEditorLanguage(editor, monaco, path);
  };

  // Function to update editor language
  const updateEditorLanguage = (editor: any, monaco: Monaco, path: string) => {
    const extension = path.split('.').pop() || '';
    const model = editor.getModel();
    
    if (!model) return;

    // Get registered languages
    const languages = monaco.languages.getLanguages();
    
    // Find matching language
    const language = languages.find(lang => 
      lang.extensions?.some(ext => ext.toLowerCase() === `.${extension.toLowerCase()}`)
    );

    if (language) {
      monaco.editor.setModelLanguage(model, language.id);
    } else {
      monaco.editor.setModelLanguage(model, defaultLanguage);
    }
  };

  // Update language when path changes
  useEffect(() => {
    if (monaco && editorRef.current) {
      updateEditorLanguage(editorRef.current, monaco, path);
    }
  }, [path, monaco]);

  // Handle content updates
  useEffect(() => {
    if (editorRef.current && content !== undefined && isMounted.current) {
      const currentValue = editorRef.current.getValue();
      if (content !== currentValue) {
        editorRef.current.setValue(content);
      }
    }
  }, [content]);

  // Cleanup on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  return (
    <div className={`relative w-full h-full bg-zinc-900/90 ${className}`} {...wrapperProps}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm">
          <div className="flex items-center space-x-2 text-zinc-400">
            <Sparkles className="w-5 h-5 animate-pulse text-lime-400" />
            <span className="text-sm font-light">Loading editor...</span>
          </div>
        </div>
      )}
      <Editor
        defaultLanguage={defaultLanguage}
        theme={theme}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        onChange={onChange}
        options={{
          automaticLayout: true,
          ...options,
        }}
      />
    </div>
  );
};

export default MonacoEditor;