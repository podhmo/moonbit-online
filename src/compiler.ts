import mooncWorker from '@moonbit/moonc-worker/moonc-worker?worker';
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
    moonInstance = moonbitMode.init({
      onigWasmUrl: '/onig.wasm',
      lspWorker: new Worker('/lsp-server.js'),
      mooncWorkerFactory: () => new mooncWorker()
    });
    moonInitialized = true;
  }
  return moonInstance!;
}

export class MoonbitCompiler {
  async compile(sourceCode: string): Promise<CompileResult> {
    const moon = await ensureMoonInit();
    
    try {
      // Use moonpad-monaco's compile function with JS output
      console.log('About to call moon.compile...');
      const result = await moon.compile({
        libInputs: [['main.mbt', sourceCode]],
        debugMain: true
      });
      console.log('moon.compile returned');

      console.log('Compile result:', result);
      console.log('Result kind:', result.kind);
      if (result.kind === 'success') {
        console.log('Result.js:', result.js);
      }

      if (result.kind === 'error') {
        console.log('Handling error case...');
        console.error('Compile error diagnostics:', result.diagnostics);
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
        console.log('Handling success case...');
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
      console.error('Exception in compile():', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('Error message:', error instanceof Error ? error.message : String(error));
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
            buffer += chunk;
          }
        })
      );
      
      return buffer;
    } catch (error) {
      throw new Error(`JS execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
