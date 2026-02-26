/// <reference types="vite/client" />
import { useState, useEffect } from 'preact/hooks';
import { MoonbitCompiler } from './compiler';
import type { TestResult } from './compiler';
import { LineNumberEditor } from './LineNumberEditor';

declare const __MOONPAD_VERSION__: string;

const compiler = new MoonbitCompiler();

// Load sample codes from src/sample_codes/*.mbt at build time via Vite glob import.
// File naming: NN_snake_case.mbt → display name (strip numeric prefix, titlecase).
const _rawSamples = import.meta.glob('./sample_codes/*.mbt', { as: 'raw', eager: true });
const SAMPLE_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(_rawSamples)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, content]) => {
      const name = path
        .replace('./sample_codes/', '')
        .replace('.mbt', '')
        .replace(/^\d+_/, '')
        .split('_')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return [name, content as string];
    })
);

const DEFAULT_CODE = Object.values(SAMPLE_CODES)[0];

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
  const [isTesting, setIsTesting] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isError, setIsError] = useState(false);
  const [warningOutput, setWarningOutput] = useState('');
  const [selectedSample, setSelectedSample] = useState<string>(Object.keys(SAMPLE_CODES)[0]);

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
    setWarningOutput('');
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
      const { output: stdout, warnings: runtimeWarnings } = await compiler.runJs(compileResult.js!);
      const warnings = [...(compileResult.warnings ?? []), ...runtimeWarnings];
      setWarningOutput(warnings.length > 0 ? `Warnings:\n${warnings.join('\n')}` : '');
      setOutput(`Output:\n${stdout || '(no output)'}`);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setOutput('Compiling tests...');
    setWarningOutput('');
    setIsError(false);

    try {
      const files = parseMultipleFiles(code);
      const compileResult = await compiler.compileTest(files);

      if (!compileResult.success) {
        setOutput(`Compilation Error:\n${compileResult.error}`);
        setIsError(true);
        return;
      }

      setOutput('Running tests...');
      const { output: stdout, results, warnings: runtimeWarnings } = await compiler.runTest(compileResult.js!);
      const passed = results.filter((r: TestResult) => r.message === '').length;
      const failed = results.filter((r: TestResult) => r.message !== '').length;
      const warnings = [...(compileResult.warnings ?? []), ...runtimeWarnings];

      const summary = `Test Results: ${passed} passed, ${failed} failed\n`;
      const details = results.map((r: TestResult) => {
        const status = r.message === '' ? '✓ PASS' : '✗ FAIL';
        const base = `${status} ${r.filename}::${r.test_name}`;
        return r.message !== '' ? `${base}\n  ${r.message}` : base;
      }).join('\n');

      const outputText = summary + details + (stdout ? `\n\nStdout:\n${stdout}` : '');
      setWarningOutput(warnings.length > 0 ? `Warnings:\n${warnings.join('\n')}` : '');
      setOutput(outputText);
      if (failed > 0) setIsError(true);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setWarningOutput('');
      setIsError(true);
    } finally {
      setIsTesting(false);
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
    const value = (e.target as HTMLSelectElement).value;
    setSelectedSample(value);
    setCode(SAMPLE_CODES[value]);
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(output).then(() => {
      alert('Output copied to clipboard!');
    }).catch((err) => {
      console.error('Failed to copy:', err);
      alert('Failed to copy output to clipboard');
    });
  };

  const handleFormat = async () => {
    setIsFormatting(true);
    try {
      const { formatCode } = await import('./formatter');
      const formatted = await formatCode(code);
      setCode(formatted);
    } catch (error) {
      console.error('Format failed:', error);
    } finally {
      setIsFormatting(false);
    }
  };

  const handleClearAll = () => {
    setCode('');
  };

  return (
    <main class="container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0 }}>🌙 MoonBit Online</h1>
          <small style={{ color: 'var(--pico-muted-color)' }}>moonpad-monaco v{__MOONPAD_VERSION__}</small>
        </div>
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
        <LineNumberEditor
          value={code}
          onChange={setCode}
          height="400px"
        />
        
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button onClick={handleRun} disabled={isRunning || isTesting}>
            {isRunning ? 'Running...' : 'Run'}
          </button>
          <button onClick={handleTest} disabled={isRunning || isTesting}>
            {isTesting ? 'Testing...' : 'Test'}
          </button>
          <button onClick={handleFormat} class="secondary" disabled={isFormatting}>
            {isFormatting ? 'Formatting...' : 'Format'}
          </button>
          <button onClick={handleClearAll} class="secondary">
            Clear All
          </button>
        </div>
      </section>
      
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <label style={{ margin: 0 }}>Output</label>
          <button 
            onClick={handleShare} 
            class="secondary"
            style={{ width: 'auto', marginBottom: 0, padding: '0.5rem 1rem' }}
          >
            Share
          </button>
          <button 
            onClick={handleCopyOutput} 
            class="secondary"
            style={{ width: 'auto', marginBottom: 0, padding: '0.5rem 1rem' }}
            disabled={!output || output === 'Ready to run...'}
          >
            Copy Output
          </button>
        </div>
        {warningOutput && (
          <pre style={{ 
            background: '#222',
            borderLeft: '4px solid #666',
            padding: '1rem',
            borderRadius: '0.25rem',
            minHeight: '2.5rem',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: '#a8a8a8',
            marginBottom: '0.75rem'
          }}>
            {warningOutput}
          </pre>
        )}
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
      </section>
    </main>
  );
}
