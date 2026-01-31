import { useState, useEffect } from 'preact/hooks';
import { MoonbitCompiler } from './compiler';
import { MonacoEditor } from './MonacoEditor';

const compiler = new MoonbitCompiler();

const SAMPLE_CODES = {
  'Hello': `fn main {
  println("Hello, MoonBit!")
  let x = 42
  println("The answer is \\{x}")
}`,
  'Multiple Files': `fn main {
  hello()
  let result = add(10, 20)
  println("10 + 20 = \\{result}")
}
-- lib.mbt --
pub fn hello() -> Unit {
  println("Hello from lib.mbt!")
}

pub fn add(a : Int, b : Int) -> Int {
  a + b
}`,
  'With Package Import': `fn main {
  // Using @moonbitlang/core/hashmap package
  let map = @hashmap.from_array([("a", 1), ("b", 2), ("c", 3)])
  println("Initial map: \\{map}")
  
  // Remove an entry
  map.remove("a") |> ignore
  println("After removing 'a': \\{map}")
  
  // Add new entries
  map.set("d", 4)
  map.set("e", 5)
  println("After adding 'd' and 'e': \\{map}")
  
  // Get a value
  match map.get("b") {
    Some(v) => println("Value of 'b': \\{v}")
    None => println("Key 'b' not found")
  }
  
  println("Map size: \\{map.size()}")
}`
};

const DEFAULT_CODE = SAMPLE_CODES['Hello'];

function parseMultipleFiles(source: string): Array<[string, string]> {
  const files: Array<[string, string]> = [];
  const lines = source.split('\n');
  
  let currentFile = 'main.mbt';
  let currentContent: string[] = [];
  
  for (const line of lines) {
    // Check for file separator: -- filename --
    const match = line.match(/^--\s+(.+?)\s+--$/);
    if (match) {
      // Save previous file
      if (currentContent.length > 0 || files.length === 0) {
        files.push([currentFile, currentContent.join('\n')]);
      }
      // Start new file
      currentFile = match[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  
  // Save last file
  if (currentContent.length > 0 || files.length === 0) {
    files.push([currentFile, currentContent.join('\n')]);
  }
  
  return files;
}

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
  const [isError, setIsError] = useState(false);
  const [selectedSample, setSelectedSample] = useState<keyof typeof SAMPLE_CODES>('Hello');

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
    setIsError(false);
    
    try {
      const files = parseMultipleFiles(code);
      const compileResult = await compiler.compileMultiple(files);
      
      if (!compileResult.success) {
        setOutput(`Compilation Error:\n${compileResult.error}`);
        setIsError(true);
        return;
      }
      
      setOutput('Running...');
      const result = await compiler.runJs(compileResult.js!);
      setOutput(`Output:\n${result || '(no output)'}`);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsError(true);
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

  const handleSampleChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value as keyof typeof SAMPLE_CODES;
    setSelectedSample(value);
    setCode(SAMPLE_CODES[value]);
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ margin: 0 }}>Code Editor</label>
          <select 
            value={selectedSample} 
            onChange={handleSampleChange}
            style={{ width: 'auto', marginBottom: 0 }}
          >
            {Object.keys(SAMPLE_CODES).map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </div>
        <MonacoEditor
          value={code}
          onChange={setCode}
          language="plaintext"
          height="400px"
        />
        
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
            background: isError ? '#2d1a1a' : '#1a1a1a',
            borderLeft: isError ? '4px solid #e74c3c' : 'none',
            padding: '1rem', 
            borderRadius: '0.25rem',
            minHeight: '150px',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: isError ? '#ff6b6b' : 'inherit'
          }}>
            {output || 'Ready to run...'}
          </pre>
        </label>
      </section>
    </main>
  );
}
