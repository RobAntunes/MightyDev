import React, { useRef, useEffect, useState } from 'react';
import Editor, { useMonaco, OnMount, Monaco } from '@monaco-editor/react';
import { Sparkles } from 'lucide-react';

interface MonacoEditorProps {
  path: string;
  content?: string;
  defaultLanguage?: string;
  defaultValue?: string;
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
  defaultLanguage = 'typescript',
  defaultValue = '',
  theme = 'vs-dark',
  onChange,
  onSave,
  className = '',
  options = {},
  wrapperProps = {},
  beforeMount
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const handleEditorWillMount = (monaco: Monaco) => {
    beforeMount?.(monaco);

    // Configure Monaco TypeScript/JavaScript defaults
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: "React",
      allowJs: true,
      typeRoots: ["node_modules/@types"]
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setIsLoading(false);

    // Configure editor settings
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'MonoLisa, Menlo, Monaco, "Courier New", monospace',
      minimap: {
        enabled: true,
        scale: 0.75,
      },
      scrollbar: {
        useShadows: false,
        vertical: 'visible',
        horizontal: 'visible',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10,
      },
      padding: {
        top: 16,
        bottom: 16,
      },
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      links: true,
      contextmenu: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      ...options
    });

    // Set up save command
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        const content = editor.getValue();
        onSave(content);
      }
    });

    // Set initial content if provided
    if (content) {
      editor.setValue(content);
    }
  };

  const getLanguageFromPath = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'css': 'css',
      'scss': 'scss',
      'less': 'less',
      'html': 'html',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'go': 'go',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'sql': 'sql',
      'yaml': 'yaml',
      'xml': 'xml'
    };
    return languageMap[extension] || defaultLanguage;
  };

  // Update editor content when content prop changes
  useEffect(() => {
    if (editorRef.current && content !== undefined) {
      const currentValue = editorRef.current.getValue();
      if (content !== currentValue) {
        editorRef.current.setValue(content);
      }
    }
  }, [content]);

  // Update editor language when path changes
  useEffect(() => {
    if (monaco && editorRef.current) {
      const language = getLanguageFromPath(path);
      monaco.editor.setModelLanguage(editorRef.current.getModel(), language);
    }
  }, [path, monaco]);

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
        defaultValue={defaultValue}
        defaultLanguage={getLanguageFromPath(path)}
        theme={theme}
        beforeMount={handleEditorWillMount}
        onMount={handleEditorDidMount}
        onChange={onChange}
        options={{
          automaticLayout: true,
          ...options
        }}
      />
    </div>
  );
};

export default MonacoEditor;