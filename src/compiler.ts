// @ts-expect-error generated JS module
import { getLoadPkgsParams } from './core/index.js';
// @ts-expect-error generated JS module
import { coreCore } from './core/core-map.js';

export interface CompileResult {
  success: boolean;
  js?: Uint8Array;
  error?: string;
}

let worker: Worker | null = null;

function ensureWorker() {
  if (!worker) {
    const base = import.meta.env.BASE_URL;
    worker = new Worker(`${base}moonc-worker.js`);
  }
  return worker;
}

function makeId() {
  return Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join('-');
}

async function callWorker(method: string, params: unknown): Promise<any> {
  const mooncWorker = ensureWorker();
  return new Promise((resolve, reject) => {
    const id = makeId();
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.id !== id) return;
      mooncWorker.removeEventListener('message', handler);
      if (data.type === 'HANDLER' && data.name === 'throw') {
        reject(new Error(data.value?.value?.message ?? 'Worker threw an error'));
      } else {
        resolve(data.value);
      }
    };
    mooncWorker.addEventListener('message', handler);
    mooncWorker.postMessage({
      id,
      type: 'APPLY',
      path: [method],
      argumentList: [{ type: 'RAW', value: params }]
    });
  });
}

export class MoonbitCompiler {
  async compile(sourceCode: string): Promise<CompileResult> {
    return this.compileMultiple([['main.mbt', sourceCode]]);
  }

  async compileMultiple(files: Array<[string, string]>): Promise<CompileResult> {
    try {
      const stdMiFiles = getLoadPkgsParams('js').filter(([, data]) => data != null);
      const buildResult = await callWorker('buildPackage', {
        mbtFiles: files,
        miFiles: [],
        indirectImportMiFiles: [],
        stdMiFiles,
        target: 'js',
        pkg: 'moonpad/lib',
        pkgSources: ['moonpad/lib:moonpad:/'],
        isMain: true,
        noOpt: false,
        enableValueTracing: false,
        errorFormat: 'json'
      });

      const diagnostics = Array.isArray(buildResult.diagnostics) ? buildResult.diagnostics : [];
      const parsedDiagnostics = diagnostics
        .map((d: string | { level?: string; loc?: any; message?: string }) => {
          if (typeof d === 'string') {
            try {
              return JSON.parse(d);
            } catch {
              return { level: 'error', message: d };
            }
          }
          return d;
        })
        .filter((d: { level?: string }) => d.level !== 'warning');

      if (parsedDiagnostics.length > 0 || !buildResult.core) {
        const errors = parsedDiagnostics
          .map((d: { loc?: { path?: string; start?: { line?: number; col?: number } }; message?: string }) => {
            const loc = d.loc?.path && d.loc?.start ? `${d.loc.path}:${d.loc.start.line}:${d.loc.start.col}` : '';
            return `${loc ? `${loc} - ` : ''}${d.message ?? 'Compilation failed'}`;
          })
          .join('\n');
        return {
          success: false,
          error: errors || 'Compilation failed: no package core output'
        };
      }

      const linkResult = await callWorker('linkCore', {
        coreFiles: [coreCore, buildResult.core],
        main: 'moonpad/lib',
        pkgSources: ['moonbitlang/core:moonbit-core:/lib/core', 'moonpad/lib:moonpad:/'],
        target: 'js',
        exportedFunctions: [],
        outputFormat: 'wasm',
        testMode: false,
        debug: false,
        stopOnMain: false,
        noOpt: false,
        sourceMap: false,
        sourceMapUrl: '',
        sources: {}
      });

      if (!linkResult.result) {
        return {
          success: false,
          error: 'Compilation succeeded but no JS output received'
        };
      }

      return {
        success: true,
        js: linkResult.result
      };
    } catch (error) {
      return {
        success: false,
        error: `Exception: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`
      };
    }
  }

  async runJs(js: Uint8Array): Promise<string> {
    try {
      if (!js || js.length === 0) {
        throw new Error('No JS bytecode provided');
      }

      const code = new TextDecoder().decode(js);
      const workerCode = `
self.console = {
  ...self.console,
  log: (...args) => self.postMessage({ __moonbit_log__: args.map((x) => String(x)).join(' ') })
};
${code}
self.postMessage({ __moonbit_done__: true });
`;
      const blobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
      const jsWorker = new Worker(blobUrl, { type: 'module' });
      let buffer = '';

      try {
        await new Promise<void>((resolve, reject) => {
          jsWorker.onmessage = (event) => {
            if (event.data?.__moonbit_done__) {
              resolve();
            } else if (event.data?.__moonbit_log__ != null) {
              buffer += `${event.data.__moonbit_log__}\n`;
            }
          };
          jsWorker.onerror = (event) => {
            reject(new Error(event.message));
          };
        });
      } finally {
        jsWorker.terminate();
        URL.revokeObjectURL(blobUrl);
      }

      return buffer;
    } catch (error) {
      throw new Error(`JS execution failed: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`);
    }
  }
}
