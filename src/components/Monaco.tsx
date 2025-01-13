import React, { useRef, useEffect } from 'react';
import Editor, { useMonaco, OnMount, Monaco } from '@monaco-editor/react';
import { readTextFile } from '@tauri-apps/plugin-fs';

interface MonacoEditorProps {
  path: string;
  defaultLanguage?: string;
  defaultValue?: string;
  theme?: 'light' | 'vs-dark';
  onChange?: (value: string | undefined) => void;
  className?: string;
  options?: any;
  wrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  beforeMount?: (monaco: Monaco) => void;
}

const MonacoEditorWrapper: React.FC<MonacoEditorProps> = ({
  path,
  defaultLanguage = 'typescript',
  defaultValue = '',
  theme = 'vs-dark',
  onChange,
  className = '',
  options = {},
  wrapperProps = {},
  beforeMount
}) => {
  const monaco = useMonaco();
  const editorRef = useRef<any>(null);

  const handleEditorWillMount = (monaco: Monaco) => {
    beforeMount?.(monaco);
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

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

    // Load file content
    loadFileContent(path);
  };

  const loadFileContent = async (filePath: string) => {
    try {
      if (!editorRef.current) return;

      const content = await readTextFile(filePath);
      editorRef.current.setValue(content);
      
      // Detect language from file extension
      const extension = filePath.split('.').pop()?.toLowerCase() || '';
      const language = getLanguageFromExtension(extension);
      
      if (monaco) {
        monaco.editor.setModelLanguage(
          editorRef.current.getModel(),
          language
        );
      }
    } catch (error) {
      console.error('Error loading file:', error);
      editorRef.current.setValue(`// Error loading file: ${error}`);
    }
  };

  const getLanguageFromExtension = (extension: string): string => {
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
      'rust': 'rust',
      'rs': 'rust',
      'toml': 'toml',
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
    return languageMap[extension] || 'plaintext';
  };

  // Handle file changes
  useEffect(() => {
    if (editorRef.current) {
      loadFileContent(path);
    }
  }, [path]);

  // Handle Monaco instance availability
  useEffect(() => {
    if (monaco) {
      monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
        noSemanticValidation: false,
        noSyntaxValidation: false,
      });
    }
  }, [monaco]);

  return (
    <div className={`w-full h-full bg-zinc-900 ${className}`} {...wrapperProps}>
      <Editor
        defaultValue={defaultValue}
        defaultLanguage={defaultLanguage}
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

export default MonacoEditorWrapper;