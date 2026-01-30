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
        const errors = (result.diagnostics || [])
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
        return {
          success: true,
          js: result.js
        };
      }

      return {
        success: false,
        error: 'Unknown compilation result'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async runJs(js: Uint8Array): Promise<string> {
    const moon = await ensureMoonInit();
    
    try {
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
      throw new Error(`JS execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
