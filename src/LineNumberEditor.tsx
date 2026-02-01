import { useRef, useEffect } from 'preact/hooks';

interface LineNumberEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
}

export function LineNumberEditor({ value, onChange, height = '400px' }: LineNumberEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Count lines in the current value
  const lines = value.split('\n');
  const lineCount = lines.length;
  
  // Calculate padding based on line count
  const padding = Math.max(3, String(lineCount).length);

  useEffect(() => {
    const textarea = textareaRef.current;
    const lineNumbers = lineNumbersRef.current;
    
    const handleScroll = () => {
      if (textarea && lineNumbers) {
        lineNumbers.scrollTop = textarea.scrollTop;
      }
    };
    
    if (textarea) {
      textarea.addEventListener('scroll', handleScroll);
      return () => textarea.removeEventListener('scroll', handleScroll);
    }
  }, []);

  return (
    <div style={{
      display: 'flex',
      border: '1px solid #424242',
      borderRadius: '0.25rem',
      overflow: 'hidden',
      background: '#1a1a1a',
      height
    }}>
      {/* Line numbers column */}
      <div
        ref={lineNumbersRef}
        style={{
          width: `${padding * 8 + 16}px`,
          background: '#0d0d0d',
          color: '#6e7681',
          fontSize: '14px',
          lineHeight: '21px',
          fontFamily: 'monospace',
          textAlign: 'right',
          paddingRight: '8px',
          paddingTop: '8px',
          paddingBottom: '8px',
          overflow: 'hidden',
          userSelect: 'none',
          borderRight: '1px solid #424242',
          flexShrink: 0
        }}
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>
            {String(i + 1).padStart(padding, '0')}
          </div>
        ))}
      </div>

      {/* Textarea for code editing */}
      <textarea
        ref={textareaRef}
        value={value}
        onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
        spellcheck={false}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          color: '#e1e4e8',
          fontSize: '14px',
          lineHeight: '21px',
          fontFamily: 'monospace',
          padding: '8px',
          resize: 'none',
          outline: 'none',
          whiteSpace: 'pre',
          overflowWrap: 'normal',
          overflowX: 'auto',
          tabSize: 2
        }}
        aria-label="Code editor"
      />
    </div>
  );
}
