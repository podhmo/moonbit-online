import * as moonbitMode from '@moonbit/moonpad-monaco';

export interface CompileResult {
  success: boolean;
  js?: Uint8Array;
  error?: string;
}

export interface TestOutput {
  kind: 'stdout' | 'result';
  stdout?: string;
  package?: string;
  filename?: string;
  test_name?: string;
  message?: string;
}

let moonInitialized = false;
let moonInstance: ReturnType<typeof moonbitMode.init> | null = null;

async function ensureMoonInit() {
  if (!moonInitialized) {
    const base = import.meta.env.BASE_URL;
    moonInstance = moonbitMode.init({
      onigWasmUrl: `${base}onig.wasm`,
      mooncWorkerFactory: () => new Worker(`${base}moonc-worker.js`)
    });
    moonInitialized = true;
  }
  return moonInstance!;
}

export class MoonbitCompiler {
  async compile(sourceCode: string): Promise<CompileResult> {
    return this.compileMultiple([['main.mbt', sourceCode]]);
  }

  async compileMultiple(files: Array<[string, string]>): Promise<CompileResult> {
    return this.compileInternal(files, false);
  }

  async compileForTest(files: Array<[string, string]>): Promise<CompileResult> {
    return this.compileInternal(files, true);
  }

  private async compileInternal(files: Array<[string, string]>, isTest: boolean): Promise<CompileResult> {
    const moon = await ensureMoonInit();
    
    try {
      const result = await moon.compile({
        libInputs: isTest ? [] : files,
        testInputs: isTest ? files : undefined,
        debugMain: !isTest
      });

      if (result.kind === 'error') {
        const diagnostics = result.diagnostics;
        if (!Array.isArray(diagnostics)) {
          return {
            success: false,
            error: `Compilation failed: diagnostics is not an array (${typeof diagnostics})`
          };
        }
        
        const errors = diagnostics
          .map((d) => {
            const loc = d.loc ? `${d.loc.path}:${d.loc.start.line}:${d.loc.start.col}` : '';
            return `${loc ? loc + ' - ' : ''}${d.message}`;
          })
          .join('\n');
        
        return {
          success: false,
          error: errors || 'Compilation failed'
        };
      }

      if (result.kind === 'success') {
        if (!result.js) {
          return {
            success: false,
            error: 'Compilation succeeded but no JS output received'
          };
        }
        return {
          success: true,
          js: result.js
        };
      }

      return {
        success: false,
        error: `Unknown compilation result kind: ${result.kind}`
      };
    } catch (error) {
      return {
        success: false,
        error: `Exception: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`
      };
    }
  }

  async runJs(js: Uint8Array): Promise<string> {
    const moon = await ensureMoonInit();
    
    try {
      if (!js || js.length === 0) {
        throw new Error('No JS bytecode provided');
      }
      
      const stream = await moon.run(js);
      let buffer = '';
      
      await stream.pipeTo(
        new WritableStream({
          write(chunk) {
            buffer += `${chunk}\n`;
          }
        })
      );
      
      return buffer;
    } catch (error) {
      throw new Error(`JS execution failed: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`);
    }
  }

  async runTest(js: Uint8Array): Promise<string> {
    const moon = await ensureMoonInit();
    
    try {
      if (!js || js.length === 0) {
        throw new Error('No JS bytecode provided');
      }
      
      const stream = await moon.test(js);
      let buffer = '';
      let testCount = 0;
      let passCount = 0;
      let failCount = 0;
      
      await stream.pipeTo(
        new WritableStream({
          write(chunk: TestOutput) {
            if (chunk.kind === 'stdout') {
              buffer += chunk.stdout || '';
            } else if (chunk.kind === 'result') {
              testCount++;
              const testName = chunk.test_name || 'unknown';
              const message = chunk.message || '';
              
              if (message.includes('FAILED') || message.toLowerCase().includes('fail')) {
                failCount++;
                buffer += `❌ ${testName}: ${message}\n`;
              } else {
                passCount++;
                buffer += `✅ ${testName}: ${message}\n`;
              }
            }
          }
        })
      );
      
      // Add summary
      if (testCount > 0) {
        buffer += `\n--- Test Summary ---\n`;
        buffer += `Total: ${testCount}, Passed: ${passCount}, Failed: ${failCount}\n`;
      }
      
      return buffer;
    } catch (error) {
      throw new Error(`Test execution failed: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`);
    }
  }
}
