import { useState } from 'preact/hooks';
import { MoonbitCompiler } from './compiler';

const compiler = new MoonbitCompiler();

export function App() {
  const [code, setCode] = useState('fn main {\n  let x = 42\n}');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);

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
      const result = await compiler.runWasm(compileResult.wasmBytes!);
      setOutput(`Output:\n${result || '(no output)'}`);
    } catch (error) {
      setOutput(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <main class="container">
      <header>
        <h1>MoonBit Online</h1>
      </header>
      
      <section>
        <label>
          Code Editor
          <textarea
            value={code}
            onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)}
            rows={15}
            style={{ fontFamily: 'monospace' }}
          />
        </label>
        
        <button onClick={handleRun} disabled={isRunning}>
          {isRunning ? 'Running...' : 'Run'}
        </button>
      </section>
      
      <section>
        <label>
          Output
          <pre style={{ background: '#1a1a1a', padding: '1rem', borderRadius: '0.25rem' }}>
            {output || 'Ready to run...'}
          </pre>
        </label>
      </section>
    </main>
  );
}
