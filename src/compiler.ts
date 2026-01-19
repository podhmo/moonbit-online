import mooncWorker from '@moonbit/moonc-worker/moonc-worker?worker';
import * as comlink from 'comlink';

export interface CompileResult {
  success: boolean;
  wasmBytes?: Uint8Array;
  error?: string;
}

export class MoonbitCompiler {
  async compile(sourceCode: string): Promise<CompileResult> {
    const worker = new mooncWorker();
    const moonc = comlink.wrap<any>(worker);

    try {
      // Build package
      const buildResult = await moonc.buildPackage({
        mbtFiles: [['main.mbt', sourceCode]],
        miFiles: [],
        stdMiFiles: [], // Standard library files
        target: 'js',
        pkg: 'main',
        pkgSources: ['main:main:/'],
        errorFormat: 'json',
        isMain: true,
        enableValueTracing: false,
        noOpt: false,
        indirectImportMiFiles: []
      });

      if (!buildResult.core) {
        return {
          success: false,
          error: 'Compilation failed: No core output'
        };
      }

      // Link as WASM
      const linkResult = await moonc.linkCore({
        coreFiles: [buildResult.core],
        exportedFunctions: [],
        main: 'main',
        outputFormat: 'wasm',
        pkgSources: ['main:main:/'],
        sources: {},
        target: 'wasm',
        testMode: false,
        sourceMap: false,
        debug: false,
        noOpt: false,
        sourceMapUrl: '',
        stopOnMain: false
      });

      console.log('Link result type:', typeof linkResult.result);
      console.log('Link result length:', linkResult.result?.length);
      console.log('Link result first bytes:', linkResult.result?.slice(0, 20));

      return {
        success: true,
        wasmBytes: linkResult.result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      worker.terminate();
    }
  }

  async runWasm(wasmBytes: Uint8Array): Promise<string> {
    const output: string[] = [];

    // Create imports for WASM module
    const imports = {
      spectest: {
        print_char: (char: number) => {
          output.push(String.fromCharCode(char));
        }
      }
    };

    try {
      const wasmModule = await WebAssembly.instantiate(wasmBytes, imports);
      const exports = wasmModule.instance.exports as any;

      if (exports.main) {
        exports.main();
      }

      return output.join('');
    } catch (error) {
      throw new Error(`WASM execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
