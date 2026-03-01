// @ts-expect-error generated JS module
import { getLoadPkgsParams } from './core/index.js';
// @ts-expect-error generated JS module
import { coreCore } from './core/core-map.js';

export interface CompileResult {
  success: boolean;
  js?: Uint8Array;
  error?: string;
  warnings?: string[];
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

function normalizeTestInfo(testInfo: string): string {
  return testInfo.replace(
    /^\s*let (with_bench_args_tests|async_tests|async_tests_with_args)\s*=.*\n?/gm,
    ''
  );
}

// Minimal test driver template compatible with the current MoonBit compiler.
// Uses `type X = Y` and `raise Error` syntax instead of the deprecated forms.
const DRIVER_TEMPLATE = `// Generated test driver
type TestDriver_No_Args_Function = () -> Unit raise Error
type TestDriver_With_Args_Function = (@moonbitlang/core/test.Test) -> Unit raise Error

type TestDriver_Tests_Map = @moonbitlang/core/builtin.Map[
  String,
  @moonbitlang/core/builtin.Array[
    (TestDriver_No_Args_Function, @moonbitlang/core/builtin.Array[String]),
  ],
]

type TestDriver_No_Args_Map = @moonbitlang/core/builtin.Map[
  String,
  @moonbitlang/core/builtin.Map[
    Int,
    (TestDriver_No_Args_Function, @moonbitlang/core/builtin.Array[String]),
  ],
]

type TestDriver_With_Args_Map = @moonbitlang/core/builtin.Map[
  String,
  @moonbitlang/core/builtin.Map[
    Int,
    (TestDriver_With_Args_Function, @moonbitlang/core/builtin.Array[String]),
  ],
]

fn typing_tests(x : TestDriver_Tests_Map) -> Unit {
  ignore(x)
}

fn typing_no_args_tests(x : TestDriver_No_Args_Map) -> Unit {
  ignore(x)
}

fn typing_with_args_tests(x : TestDriver_With_Args_Map) -> Unit {
  ignore(x)
}

fn main {
  let tests = {  } // WILL BE REPLACED
  let no_args_tests = {  } // WILL BE REPLACED
  let with_args_tests = {  } // WILL BE REPLACED
  typing_tests(tests)
  typing_no_args_tests(no_args_tests)
  typing_with_args_tests(with_args_tests)
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
            Failure::Failure(e) | InspectError::InspectError(e) => e
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
const RUN_WAIT_PROMISE_KEY = '__moonbit_run_wait_promise__';

function resetWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
  }
}

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
      resetWorker();
      const stdMiFiles = getLoadPkgsParams('js').filter(([, data]) => data != null);
      const hasPackagePaths = files.some(([name]) => name.includes('/'));

      if (hasPackagePaths) {
        const packageFiles = new Map<string, Array<[string, string]>>();
        for (const [name, content] of files) {
          if (name.includes('/')) {
            const parts = name.split('/');
            if (parts.length !== 2 || !parts[0] || !parts[1]) {
              return {
                success: false,
                error: `Only single-level package paths are supported: "pkg/file.mbt" (got "${name}")`
              };
            }
            const pkg = parts[0];
            if (!packageFiles.has(pkg)) packageFiles.set(pkg, []);
            packageFiles.get(pkg)!.push([name, content]);
          } else {
            const fallbackPkg = 'main';
            if (!packageFiles.has(fallbackPkg)) packageFiles.set(fallbackPkg, []);
            packageFiles.get(fallbackPkg)!.push([`${fallbackPkg}/${name}`, content]);
          }
        }

        const packageNames = [...packageFiles.keys()];
        if (packageNames.length === 0) {
          return { success: false, error: 'No files provided' };
        }

        const depGraph = new Map<string, Set<string>>();
        for (const [pkg, pkgFiles] of packageFiles.entries()) {
          const deps = new Set<string>();
          for (const [, content] of pkgFiles) {
            // Heuristic only: detect user package refs by `@pkg.` usage in source text.
            for (const match of content.matchAll(/@([A-Za-z0-9_]+)\./g)) {
              const dep = match[1];
              if (dep !== pkg && packageFiles.has(dep)) deps.add(dep);
            }
          }
          depGraph.set(pkg, deps);
        }

        const orderedPkgs: string[] = [];
        const visiting = new Set<string>();
        const visited = new Set<string>();
        const visit = (pkg: string) => {
          if (visited.has(pkg)) return;
          if (visiting.has(pkg)) {
            throw new Error(`Cyclic package dependency detected around "${pkg}"`);
          }
          visiting.add(pkg);
          for (const dep of depGraph.get(pkg) ?? []) visit(dep);
          visiting.delete(pkg);
          visited.add(pkg);
          orderedPkgs.push(pkg);
        };
        for (const pkg of packageNames) visit(pkg);

        const pkgSources = packageNames.map((pkg) => `moonpad/${pkg}:moonpad:/${pkg}/`);
        const packageWithMainFile = packageNames.find((pkg) =>
          (packageFiles.get(pkg) ?? []).some(([filename]) => filename.endsWith('/main.mbt'))
        );
        const mainPkg = packageFiles.has('main')
          ? 'main'
          : (packageWithMainFile ?? [...packageNames].sort((a, b) => a.localeCompare(b))[0]);
        const pkgArtifacts = new Map<string, { mi: Uint8Array; core: Uint8Array }>();
        const allWarnings: string[] = [];

        for (const pkg of orderedPkgs) {
          const depMiFiles: Array<[string, Uint8Array]> = [];
          for (const dep of depGraph.get(pkg) ?? []) {
            const depArtifact = pkgArtifacts.get(dep);
            if (depArtifact) depMiFiles.push([`moonpad/${dep}.mi`, depArtifact.mi]);
          }

          const buildResult = await callWorker('buildPackage', {
            mbtFiles: packageFiles.get(pkg)!,
            miFiles: depMiFiles,
            indirectImportMiFiles: [],
            stdMiFiles,
            target: 'js',
            pkg: `moonpad/${pkg}`,
            pkgSources,
            isMain: pkg === mainPkg,
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
            });
          const errorsOnly = parsedDiagnostics.filter((d: { level?: string }) => d.level !== 'warning');
          const warnings = parsedDiagnostics
            .filter((d: { level?: string }) => d.level === 'warning')
            .map((d: { loc?: { path?: string; start?: { line?: number; col?: number } }; message?: string }) => {
              const loc = d.loc?.path && d.loc?.start ? `${d.loc.path}:${d.loc.start.line}:${d.loc.start.col}` : '';
              return `${loc ? `${loc} - ` : ''}${d.message ?? 'Warning'}`;
            });
          allWarnings.push(...warnings);

          if (errorsOnly.length > 0 || !buildResult.core || !buildResult.mi) {
            const errors = errorsOnly
              .map((d: { loc?: { path?: string; start?: { line?: number; col?: number } }; message?: string }) => {
                const loc = d.loc?.path && d.loc?.start ? `${d.loc.path}:${d.loc.start.line}:${d.loc.start.col}` : '';
                return `${loc ? `${loc} - ` : ''}${d.message ?? 'Compilation failed'}`;
              })
              .join('\n');
            return {
              success: false,
              error: errors || `Compilation failed in package "${pkg}": no package core/mi output`
            };
          }

          pkgArtifacts.set(pkg, { mi: buildResult.mi, core: buildResult.core });
        }

        const linkCoreFiles: Uint8Array[] = [coreCore, ...orderedPkgs.map((pkg) => pkgArtifacts.get(pkg)!.core)];
        const linkResult = await callWorker('linkCore', {
          coreFiles: linkCoreFiles,
          main: `moonpad/${mainPkg}`,
          pkgSources: ['moonbitlang/core:moonbit-core:/lib/core', ...pkgSources],
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
          js: linkResult.result,
          warnings: allWarnings
        };
      }

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
        });
      const errorsOnly = parsedDiagnostics.filter((d: { level?: string }) => d.level !== 'warning');
      const warnings = parsedDiagnostics
        .filter((d: { level?: string }) => d.level === 'warning')
        .map((d: { loc?: { path?: string; start?: { line?: number; col?: number } }; message?: string }) => {
          const loc = d.loc?.path && d.loc?.start ? `${d.loc.path}:${d.loc.start.line}:${d.loc.start.col}` : '';
          return `${loc ? `${loc} - ` : ''}${d.message ?? 'Warning'}`;
        });

      if (errorsOnly.length > 0 || !buildResult.core) {
        const errors = errorsOnly
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
        js: linkResult.result,
        warnings
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
      if (files.some(([name]) => name.includes('/'))) {
        return {
          success: false,
          error: 'Test mode does not support multiple packages yet'
        };
      }
      resetWorker();
      const stdMiFiles = getLoadPkgsParams('js').filter(([, data]: [string, unknown]) => data != null);

      const rawTestInfo: string = await callWorker('genTestInfo', { mbtFiles: files });
      const testInfo = normalizeTestInfo(rawTestInfo);

      const driverContent = DRIVER_TEMPLATE
        .replace(DRIVER_TEMPLATE_REPLACEMENT, testInfo)
        .replace('{PACKAGE}', 'moonpad/lib')
        .replace('{BEGIN_MOONTEST}', MOON_TEST_DELIMITER_BEGIN)
        .replace('{END_MOONTEST}', MOON_TEST_DELIMITER_END);

      // Strip any empty `fn main {}` from user files; the driver provides its own fn main.
      const userFiles = files.map(([name, content]): [string, string] => [
        name,
        content.replace(/\bfn\s+main\s*\{\s*\}/gs, '')
      ]);
      const allFiles: Array<[string, string]> = [...userFiles, ['driver.mbt', driverContent]];

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
        });
      const errorsOnly = parsedDiagnostics.filter((d: { level?: string }) => d.level !== 'warning');
      const warnings = parsedDiagnostics
        .filter((d: { level?: string }) => d.level === 'warning')
        .map((d: { loc?: { path?: string; start?: { line?: number; col?: number } }; message?: string }) => {
          const loc = d.loc?.path && d.loc?.start ? `${d.loc.path}:${d.loc.start.line}:${d.loc.start.col}` : '';
          return `${loc ? `${loc} - ` : ''}${d.message ?? 'Warning'}`;
        });

      if (errorsOnly.length > 0 || !buildResult.core) {
        const errors = errorsOnly
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

      return { success: true, js: linkResult.result, warnings };
    } catch (error) {
      return {
        success: false,
        error: `Exception: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`
      };
    }
  }

  async runTest(js: Uint8Array): Promise<{ output: string; results: TestResult[]; warnings: string[] }> {
    const { output: raw, warnings } = await this.runJs(js);
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
          // Malformed lines between delimiters are silently skipped;
          // the driver only emits well-formed JSON there, so this is a no-op in practice.
        }
      } else {
        stdoutLines.push(line);
      }
    }

    return { output: stdoutLines.join('\n').trimEnd(), results, warnings };
  }

  async runJs(js: Uint8Array): Promise<{ output: string; warnings: string[] }> {
    try {
      if (!js || js.length === 0) {
        throw new Error('No JS bytecode provided');
      }

      const code = new TextDecoder().decode(js);
      const workerCode = `
self.console = {
  ...self.console,
  log: (...args) => self.postMessage({ __moonbit_log__: args.map((x) => String(x)).join(' ') }),
  warn: (...args) => self.postMessage({ __moonbit_warn__: args.map((x) => String(x)).join(' ') })
};
${code}
Promise.resolve(self[${JSON.stringify(RUN_WAIT_PROMISE_KEY)}])
  .catch((error) => {
    const details = error && typeof error === 'object'
      ? [error.message, error.stack].filter(Boolean).join('\\n')
      : String(error);
    self.postMessage({ __moonbit_warn__: details || String(error) });
  })
  .finally(() => self.postMessage({ __moonbit_done__: true }));
`;
      const blobUrl = URL.createObjectURL(new Blob([workerCode], { type: 'text/javascript' }));
      const jsWorker = new Worker(blobUrl, { type: 'module' });
      let buffer = '';
      const warnings: string[] = [];

      try {
        await new Promise<void>((resolve, reject) => {
          jsWorker.onmessage = (event) => {
            if (event.data?.__moonbit_done__) {
              resolve();
            } else if (event.data?.__moonbit_log__ != null) {
              buffer += `${event.data.__moonbit_log__}\n`;
            } else if (event.data?.__moonbit_warn__ != null) {
              warnings.push(`runtime warning: ${String(event.data.__moonbit_warn__)}`);
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

      return { output: buffer, warnings };
    } catch (error) {
      throw new Error(`JS execution failed: ${error instanceof Error ? error.message : String(error)}\nStack: ${error instanceof Error ? error.stack : ''}`);
    }
  }
}
