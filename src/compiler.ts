import * as moonbitMode from '@moonbit/moonpad-monaco';

export interface CompileResult {
  success: boolean;
  js?: Uint8Array;
  error?: string;
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
    const moon = await ensureMoonInit();
    
    try {
      const result = await moon.compile({
        libInputs: files,
        debugMain: true
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
}
