import { useState, useEffect } from 'preact/hooks';
import { MoonbitCompiler } from './compiler';

const compiler = new MoonbitCompiler();

const DEFAULT_CODE = 'fn main {\n  println("Hello, MoonBit!")\n}';

function loadCodeFromHash(): string {
  const hash = window.location.hash.slice(1);
  if (!hash) return DEFAULT_CODE;
  
  try {
    return decodeURIComponent(atob(hash));
  } catch (e) {
    console.error('Failed to decode hash:', e);
    return DEFAULT_CODE;
  }
}

export function App() {
  const [code, setCode] = useState(loadCodeFromHash());
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  // Load code from URL hash on mount
  useEffect(() => {
    const handleHashChange = () => {
      const newCode = loadCodeFromHash();
      setCode(newCode);
    };
    
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleRun = async () => {
    setIsRunning(true);
    setOutput('Compiling...');
    
    try {
      const compileResult = await compiler.compile(code);
      
      if (!compileResult.success) {
        setOutput(`Compilation Error:\n${compileResult.error}`);
        return;
      }
      
      setOutput('Running...');
      const result = await compiler.runJs(compileResult.js!);
      setOutput(`Output:\n${result || '(no output)'}`);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleShare = () => {
    const encoded = btoa(encodeURIComponent(code));
    const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link copied to clipboard!');
    });
  };

  return (
    <main class="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🌙 MoonBit Online</h1>
        <a 
          href="https://github.com/podhmo/moonbit-online" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ fontSize: '1.5rem', textDecoration: 'none' }}
          aria-label="View on GitHub"
        >
          GitHub
        </a>
      </header>
      
      <section>
        <label>
          Code Editor
          <textarea
            value={code}
            onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)}
            rows={15}
            style={{ 
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.5'
            }}
          />
        </label>
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button onClick={handleShare} class="secondary">
            Share
          </button>
        </div>
      </section>
      
      <section>
        <label>
          Output
          <pre style={{ 
            background: '#1a1a1a', 
            padding: '1rem', 
            borderRadius: '0.25rem',
            minHeight: '150px',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {output || 'Ready to run...'}
          </pre>
        </label>
      </section>
    </main>
  );
}
