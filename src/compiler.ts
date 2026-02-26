// @ts-expect-error generated JS module
import { getLoadPkgsParams } from './core/index.js';
// @ts-expect-error generated JS module
import { coreCore } from './core/core-map.js';

export interface CompileResult {
  success: boolean;
  js?: Uint8Array;
  error?: string;
}

export interface TestResult {
  package: string;
  filename: string;
  test_name: string;
  message: string;
}

const MOON_TEST_DELIMITER_BEGIN = '----- BEGIN MOON TEST RESULT -----';
const MOON_TEST_DELIMITER_END = '----- END MOON TEST RESULT -----';

// Replacement marker in the driver template (matches genTestInfo output)
const DRIVER_TEMPLATE_REPLACEMENT =
  'let tests = {  } // WILL BE REPLACED\n  let no_args_tests = {  } // WILL BE REPLACED\n  let with_args_tests = {  } // WILL BE REPLACED';

// Minimal test driver template compatible with the current MoonBit compiler.
// Uses `type X = Y` and `raise Error` syntax instead of the deprecated forms.
const DRIVER_TEMPLATE = `// Generated test driver
type TestDriver_No_Args_Function = () -> Unit raise Error

type TestDriver_No_Args_Map = @moonbitlang/core/builtin.Map[
  String,
  @moonbitlang/core/builtin.Map[
    Int,
    (TestDriver_No_Args_Function, @moonbitlang/core/builtin.Array[String]),
  ],
]

fn typing_no_args_tests(x : TestDriver_No_Args_Map) -> Unit {
  ignore(x)
}

fn main {
  let tests = {  } // WILL BE REPLACED
  let no_args_tests = {  } // WILL BE REPLACED
  let with_args_tests = {  } // WILL BE REPLACED
  ignore(tests)
  typing_no_args_tests(no_args_tests)
  ignore(with_args_tests)
  no_args_tests
  .iter()
  .each(
    fn(file) {
      let filename = file.0
      let cases = file.1
      cases
      .iter()
      .each(
        fn(case_entry) {
          let idx = case_entry.0
          let func = case_entry.1.0
          let attrs = case_entry.1.1
          let name = if attrs.is_empty() { idx.to_string() } else { attrs[0] }
          let message = try {
            func()
            ""
          } catch {
            Failure(e) | InspectError(e) => e
            _ => "unexpected error"
          }
          println("{BEGIN_MOONTEST}")
          println(
            "{\\"package\\": \\"{PACKAGE}\\", \\"filename\\": \\{filename.escape()}, \\"test_name\\": \\{name.escape()}, \\"message\\": \\{message.escape()}}",
          )
          println("{END_MOONTEST}")
        },
      )
    },
  )
}`;

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

  async compileTest(files: Array<[string, string]>): Promise<CompileResult> {
    try {
      const stdMiFiles = getLoadPkgsParams('js').filter(([, data]: [string, unknown]) => data != null);

      const testInfo: string = await callWorker('genTestInfo', { mbtFiles: files });

      const driverContent = DRIVER_TEMPLATE
        .replace(DRIVER_TEMPLATE_REPLACEMENT, testInfo)
        .replace('{PACKAGE}', 'moonpad/lib')
        .replace('{BEGIN_MOONTEST}', MOON_TEST_DELIMITER_BEGIN)
        .replace('{END_MOONTEST}', MOON_TEST_DELIMITER_END);

      const allFiles: Array<[string, string]> = [...files, ['driver.mbt', driverContent]];

      const buildResult = await callWorker('buildPackage', {
        mbtFiles: allFiles,
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
            try { return JSON.parse(d); } catch { return { level: 'error', message: d }; }
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
        main: 'moonpad/lib_blackbox_test',
        pkgSources: ['moonbitlang/core:moonbit-core:/lib/core', 'moonpad/lib:moonpad:/'],
        target: 'js',
        exportedFunctions: [],
        outputFormat: 'wasm',
        testMode: true,
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

      return { success: true, js: linkResult.result };
    } catch (error) {
      return {
        success: false,
        error: `Exception: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`
      };
    }
  }

  async runTest(js: Uint8Array): Promise<{ output: string; results: TestResult[] }> {
    const raw = await this.runJs(js);
    const lines = raw.split('\n');
    const results: TestResult[] = [];
    let inSection = false;
    const stdoutLines: string[] = [];

    for (const line of lines) {
      if (line === MOON_TEST_DELIMITER_BEGIN) {
        inSection = true;
      } else if (line === MOON_TEST_DELIMITER_END) {
        inSection = false;
      } else if (inSection) {
        try {
          results.push(JSON.parse(line) as TestResult);
        } catch {
          // ignore malformed lines
        }
      } else {
        stdoutLines.push(line);
      }
    }

    return { output: stdoutLines.join('\n').trimEnd(), results };
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
