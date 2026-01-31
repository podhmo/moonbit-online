import { useEffect, useRef } from 'preact/hooks';
import * as monaco from 'monaco-editor-core';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
}

export function MonacoEditor({ value, onChange, language = 'plaintext', height = '400px' }: MonacoEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const isUpdatingFromProps = useRef(false);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;

    // Create Monaco editor instance
    const editor = monaco.editor.create(editorRef.current, {
      value: value,
      language: language,
      theme: 'vs-dark',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineHeight: 21,
      fontFamily: 'monospace',
      // Line number configuration with custom formatting
      lineNumbers: (lineNumber: number) => {
        // Zero-pad to 3 digits (001, 002, etc.)
        // Note: Hardcoded to 3 digits as files rarely exceed 999 lines in typical usage
        return lineNumber.toString().padStart(3, '0');
      },
      lineNumbersMinChars: 4, // Reserve space for 3 digits + 1 space
      glyphMargin: false,
      folding: false,
      lineDecorationsWidth: 5,
      renderLineHighlight: 'all',
    });

    monacoEditorRef.current = editor;

    // Listen to content changes
    editor.onDidChangeModelContent(() => {
      if (!isUpdatingFromProps.current) {
        const newValue = editor.getValue();
        onChangeRef.current(newValue);
      }
    });

    // Cleanup
    return () => {
      editor.dispose();
    };
  }, []); // Only run once on mount

  // Update editor content when value prop changes
  useEffect(() => {
    if (monacoEditorRef.current && monacoEditorRef.current.getValue() !== value) {
      isUpdatingFromProps.current = true;
      const position = monacoEditorRef.current.getPosition();
      monacoEditorRef.current.setValue(value);
      if (position) {
        monacoEditorRef.current.setPosition(position);
      }
      isUpdatingFromProps.current = false;
    }
  }, [value]);

  return (
    <div 
      ref={editorRef} 
      style={{ 
        height, 
        border: '1px solid #424242',
        borderRadius: '0.25rem',
        overflow: 'hidden'
      }} 
    />
  );
}
