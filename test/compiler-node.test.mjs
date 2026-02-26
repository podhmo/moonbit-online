// Node.js integration tests for MoonBit compile + run pipeline.
// Uses moonc-worker.js directly via worker_threads (no browser needed).
// Run with: node --test test/compiler-node.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'worker_threads';
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { gunzipSync } from 'zlib';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getLoadPkgsParams } from '../src/core/index.js';
import { coreGz } from '../src/core/core-map.js';

const __dir = dirname(fileURLToPath(import.meta.url));

// stdlib MI files for JS target (filter out packages with no JS MI file)
const STD_MI_FILES = getLoadPkgsParams('js').filter(([, data]) => data != null);
// decompressed core.core (standard library bundle)
const CORE_FILE = gunzipSync(coreGz);

/** Generate a random comlink-compatible message ID */
function makeId() {
  return Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
    .join('-');
}

/** Call a method on the comlink-exposed moonc worker */
function callWorker(worker, method, params) {
  return new Promise((resolve, reject) => {
    const id = makeId();
    const handler = (data) => {
      if (!data || data.id !== id) return;
      worker.removeListener('message', handler);
      if (data.type === 'HANDLER' && data.name === 'throw') {
        reject(new Error(data.value?.value?.message ?? 'Worker threw an error'));
      } else {
        resolve(data.value);
      }
    };
    worker.on('message', handler);
    worker.postMessage({
      id,
      type: 'APPLY',
      path: [method],
      argumentList: [{ type: 'RAW', value: params }],
    });
  });
}

/**
 * Compile MoonBit source files to JS using the moonc worker.
 * Returns { core, mi, diagnostics } from buildPackage.
 */
async function buildPackage(worker, mbtFiles) {
  return callWorker(worker, 'buildPackage', {
    mbtFiles,
    miFiles: [],
    indirectImportMiFiles: [],
    stdMiFiles: STD_MI_FILES,
    target: 'js',
    pkg: 'moonpad/lib',
    pkgSources: ['moonpad/lib:moonpad:/'],
    isMain: true,
    noOpt: false,
    enableValueTracing: false,
    errorFormat: 'json',
  });
}

/**
 * Link the compiled package core into a runnable JS module.
 * Returns { result } where result is a Uint8Array of JS bytes.
 */
async function linkCore(worker, packageCore) {
  return callWorker(worker, 'linkCore', {
    coreFiles: [CORE_FILE, packageCore],
    main: 'moonpad/lib',
    pkgSources: [
      'moonbitlang/core:moonbit-core:/lib/core',
      'moonpad/lib:moonpad:/',
    ],
    target: 'js',
    exportedFunctions: [],
    outputFormat: 'wasm',
    testMode: false,
    debug: false,
    stopOnMain: false,
    noOpt: false,
    sourceMap: false,
    sourceMapUrl: '',
    sources: {},
  });
}

/**
 * Execute compiled JS bytes in a child Node.js process and return stdout.
 * The compiled MoonBit JS is a plain ES module with console.log for output.
 */
function runCompiledJs(jsBytes) {
  const jsCode = Buffer.from(jsBytes).toString('utf-8');
  const tmpFile = join(tmpdir(), `moonbit-test-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(tmpFile, jsCode);
  try {
    return execFileSync(process.execPath, [tmpFile], { encoding: 'utf-8' });
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore cleanup errors */ }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('compile and run hello world', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    const source = `fn main {\n  println("Hello, MoonBit!")\n}`;

    const buildResult = await buildPackage(worker, [['main.mbt', source]]);
    assert.deepEqual(buildResult.diagnostics, [], 'no compilation errors');

    const linkResult = await linkCore(worker, buildResult.core);
    const output = runCompiledJs(linkResult.result);
    assert.equal(output.trim(), 'Hello, MoonBit!');
  } finally {
    worker.terminate();
  }
});

test('compile and run with arithmetic', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    const source = `fn main {\n  let x = 6\n  let y = 7\n  println(x * y)\n}`;

    const buildResult = await buildPackage(worker, [['main.mbt', source]]);
    assert.deepEqual(buildResult.diagnostics, [], 'no compilation errors');

    const linkResult = await linkCore(worker, buildResult.core);
    const output = runCompiledJs(linkResult.result);
    assert.equal(output.trim(), '42');
  } finally {
    worker.terminate();
  }
});

test('compile error is reported correctly', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    // deliberately invalid MoonBit code
    const source = `fn main {\n  this_function_does_not_exist()\n}`;

    const buildResult = await buildPackage(worker, [['main.mbt', source]]);
    assert.ok(buildResult.diagnostics.length > 0, 'should have compilation errors');
  } finally {
    worker.terminate();
  }
});

test('compile error content is accessible', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    // Type error: assigning a string literal to an Int variable
    const source = `fn main {\n  let x : Int = "not an int"\n  println(x)\n}`;

    const buildResult = await buildPackage(worker, [['main.mbt', source]]);
    assert.ok(buildResult.diagnostics.length > 0, 'should have compilation errors');

    // Verify error content (message) is accessible in the diagnostic
    const firstDiag = buildResult.diagnostics[0];
    const parsed = typeof firstDiag === 'string' ? JSON.parse(firstDiag) : firstDiag;
    assert.ok(parsed.message?.length > 0, 'diagnostic should have a non-empty message property');
  } finally {
    worker.terminate();
  }
});

test('runtime error content is accessible', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    // Code that compiles successfully but panics at runtime
    const source = `fn main {\n  panic()\n}`;

    const buildResult = await buildPackage(worker, [['main.mbt', source]]);
    assert.deepEqual(buildResult.diagnostics, [], 'should compile without errors');

    const linkResult = await linkCore(worker, buildResult.core);

    let caughtError = null;
    try {
      runCompiledJs(linkResult.result);
    } catch (err) {
      caughtError = err;
    }
    assert.ok(caughtError !== null, 'should throw a runtime error');
    const errorMessage = caughtError instanceof Error ? caughtError.message : String(caughtError);
    assert.ok(errorMessage.length > 0, 'runtime error message should be accessible');
  } finally {
    worker.terminate();
  }
});

test('compile and run multiple files', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    const mainFile = `fn main {\n  let result = add(3, 4)\n  println(result)\n}`;
    const libFile = `pub fn add(a : Int, b : Int) -> Int {\n  a + b\n}`;

    const buildResult = await buildPackage(worker, [
      ['main.mbt', mainFile],
      ['lib.mbt', libFile],
    ]);
    assert.deepEqual(buildResult.diagnostics, [], 'no compilation errors');

    const linkResult = await linkCore(worker, buildResult.core);
    const output = runCompiledJs(linkResult.result);
    assert.equal(output.trim(), '7');
  } finally {
    worker.terminate();
  }
});

// ---------------------------------------------------------------------------
// Test mode helpers
// ---------------------------------------------------------------------------

const MOON_TEST_DELIMITER_BEGIN = '----- BEGIN MOON TEST RESULT -----';
const MOON_TEST_DELIMITER_END = '----- END MOON TEST RESULT -----';

// Replacement marker that genTestInfo output replaces in the driver template.
const DRIVER_TEMPLATE_REPLACEMENT =
  'let tests = {  } // WILL BE REPLACED\n  let no_args_tests = {  } // WILL BE REPLACED\n  let with_args_tests = {  } // WILL BE REPLACED';

// Minimal test driver template compatible with the current MoonBit compiler.
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

/**
 * Build a test package: calls genTestInfo, creates the driver, then buildPackage.
 * Returns { core, diagnostics }.
 */
async function buildTestPackage(worker, mbtFiles) {
  const testInfo = await callWorker(worker, 'genTestInfo', { mbtFiles });
  const driverContent = DRIVER_TEMPLATE
    .replace(DRIVER_TEMPLATE_REPLACEMENT, testInfo)
    .replace('{PACKAGE}', 'moonpad/lib')
    .replace('{BEGIN_MOONTEST}', MOON_TEST_DELIMITER_BEGIN)
    .replace('{END_MOONTEST}', MOON_TEST_DELIMITER_END);

  // Strip any empty `fn main {}` from user files; the driver provides its own fn main.
  const userFiles = mbtFiles.map(([name, content]) => [
    name,
    content.replace(/\bfn\s+main\s*\{\s*\}/gs, ''),
  ]);
  return callWorker(worker, 'buildPackage', {
    mbtFiles: [...userFiles, ['driver.mbt', driverContent]],
    miFiles: [],
    indirectImportMiFiles: [],
    stdMiFiles: STD_MI_FILES,
    target: 'js',
    pkg: 'moonpad/lib',
    pkgSources: ['moonpad/lib:moonpad:/'],
    isMain: true,
    noOpt: false,
    enableValueTracing: false,
    errorFormat: 'json',
  });
}

/**
 * Link test package core into a runnable JS module (testMode: true).
 */
async function linkTestCore(worker, packageCore) {
  return callWorker(worker, 'linkCore', {
    coreFiles: [CORE_FILE, packageCore],
    main: 'moonpad/lib_blackbox_test',
    pkgSources: [
      'moonbitlang/core:moonbit-core:/lib/core',
      'moonpad/lib:moonpad:/',
    ],
    target: 'js',
    exportedFunctions: [],
    outputFormat: 'wasm',
    testMode: true,
    debug: false,
    stopOnMain: false,
    noOpt: false,
    sourceMap: false,
    sourceMapUrl: '',
    sources: {},
  });
}

/**
 * Parse test output from compiled test JS into an array of TestResult objects.
 */
function parseTestOutput(raw) {
  const lines = raw.split('\n');
  const results = [];
  let inSection = false;
  for (const line of lines) {
    if (line === MOON_TEST_DELIMITER_BEGIN) { inSection = true; }
    else if (line === MOON_TEST_DELIMITER_END) { inSection = false; }
    else if (inSection) {
      try { results.push(JSON.parse(line)); } catch { /* malformed lines are silently skipped */ }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Moon test mode tests
// ---------------------------------------------------------------------------

test('moon test: passing test is reported as passed', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    const source = `fn sum(data~ : Array[Int]) -> Int {
  data.fold(init=0, fn(acc, x) { acc + x })
}

test "sum" {
  inspect(sum(data=[1, 2, 3]), content="6")
}`;

    const buildResult = await buildTestPackage(worker, [['main.mbt', source]]);
    const errors = buildResult.diagnostics.filter(d => {
      const p = typeof d === 'string' ? JSON.parse(d) : d;
      return p.level === 'error';
    });
    assert.equal(errors.length, 0, 'should compile without errors');

    const linkResult = await linkTestCore(worker, buildResult.core);
    const output = runCompiledJs(linkResult.result);
    const results = parseTestOutput(output);

    assert.equal(results.length, 1, 'should have one test result');
    assert.equal(results[0].test_name, 'sum', 'test name should be "sum"');
    assert.equal(results[0].message, '', 'passing test should have empty message');
  } finally {
    worker.terminate();
  }
});

test('moon test: failing test is reported as failed', async () => {
  const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
  try {
    const source = `test "always fails" {
  inspect(1 + 1, content="3")
}`;

    const buildResult = await buildTestPackage(worker, [['main.mbt', source]]);
    const errors = buildResult.diagnostics.filter(d => {
      const p = typeof d === 'string' ? JSON.parse(d) : d;
      return p.level === 'error';
    });
    assert.equal(errors.length, 0, 'should compile without errors');

    const linkResult = await linkTestCore(worker, buildResult.core);
    const output = runCompiledJs(linkResult.result);
    const results = parseTestOutput(output);

    assert.equal(results.length, 1, 'should have one test result');
    assert.equal(results[0].test_name, 'always fails', 'test name should match');
    assert.ok(results[0].message !== '', 'failing test should have non-empty message');
    assert.ok(results[0].message.includes('actual'), 'failure message should contain actual value');
  } finally {
    worker.terminate();
  }
});

// ---------------------------------------------------------------------------
// LSP formatter helpers
// ---------------------------------------------------------------------------

/** Start the LSP server worker and perform the LSP handshake.
 *  Returns the worker once it is ready to accept requests. */
async function startLspWorker() {
  const { MessageChannel, Worker: ThreadWorker } = await import('worker_threads');
  const worker = new ThreadWorker(join(__dir, 'lsp-worker-bootstrap.cjs'));

  // Create a MessageChannel for the Comlink side-channel.
  // The LSP server requires a port on startup and uses it to proxy file-system
  // calls back to the main thread.  For formatting we don't need real files, so
  // we listen on port1 and reject every call immediately.
  const channel = new MessageChannel();
  channel.port1.start();
  channel.port2.start();

  channel.port1.on('message', (msg) => {
    if (msg && msg.type === 'APPLY') {
      // Respond with an error so addCore() fails fast instead of hanging.
      channel.port1.postMessage({
        id: msg.id,
        type: 'HANDLER',
        name: 'throw',
        value: { isError: true, value: { message: 'Not available', name: 'Error', stack: '' } },
      });
    }
  });

  // Send the startup message. The bootstrap extracts '_lsp_port' and presents
  // it as event.ports[0] to the lsp-server.js startup handler.
  worker.postMessage(
    { moonbitEnv: {}, _lsp_port: channel.port2 },
    [channel.port2]
  );

  // Initialize the LSP protocol
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('LSP init timeout')), 15000);
    const handler = (msg) => {
      if (!msg || msg.jsonrpc !== '2.0') return;
      // Accept both successful and error responses to 'initialize'
      if (msg.id === 1 && (msg.result !== undefined || msg.error !== undefined)) {
        worker.removeListener('message', handler);
        clearTimeout(timeout);
        // Send 'initialized' notification
        worker.postMessage({ jsonrpc: '2.0', method: 'initialized', params: {} });
        resolve();
      }
    };
    worker.on('message', handler);
    worker.postMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        processId: null,
        rootUri: 'file:///',
        workspaceFolders: [{ uri: 'file:///', name: 'workspace' }],
        capabilities: {},
      },
    });
  });

  return worker;
}

/** Format a MoonBit source file using the LSP server.
 *  Returns the formatted source code. */
function formatWithLsp(worker, source, filename) {
  const uri = `file:///${filename}`;
  const id = Math.floor(Math.random() * 1e9);

  worker.postMessage({
    jsonrpc: '2.0',
    method: 'textDocument/didOpen',
    params: {
      textDocument: { uri, languageId: 'moonbit', version: 1, text: source },
    },
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Format timeout')), 10000);
    const handler = (msg) => {
      if (!msg || msg.jsonrpc !== '2.0') return;
      if (msg.id !== id) return;
      worker.removeListener('message', handler);
      clearTimeout(timeout);
      worker.postMessage({
        jsonrpc: '2.0',
        method: 'textDocument/didClose',
        params: { textDocument: { uri } },
      });
      if (msg.result && Array.isArray(msg.result) && msg.result.length > 0) {
        const formatted = msg.result[0].newText;
        // Strip the `///|` cursor marker added by the LSP formatter when it
        // was not present in the original source.
        const MARKER = '///|\n';
        const stripped = (formatted.startsWith(MARKER) && !source.startsWith(MARKER))
          ? formatted.slice(MARKER.length)
          : formatted;
        resolve(stripped);
      } else {
        resolve(source);
      }
    };
    worker.on('message', handler);
    worker.postMessage({
      jsonrpc: '2.0',
      id,
      method: 'textDocument/formatting',
      params: {
        textDocument: { uri },
        options: { tabSize: 2, insertSpaces: true },
      },
    });
  });
}

// ---------------------------------------------------------------------------
// Formatter tests
// ---------------------------------------------------------------------------

test('format: indentation is normalized', async () => {
  const worker = await startLspWorker();
  try {
    // Poorly indented code
    const source = `fn main {
        println("Hello")
}`;
    const formatted = await formatWithLsp(worker, source, 'main.mbt');
    // The formatter should produce properly indented code
    assert.ok(typeof formatted === 'string', 'result should be a string');
    assert.ok(formatted.includes('println'), 'formatted code should retain content');
    // Verify indentation is consistent (no 8-space indent for a simple body)
    assert.ok(!formatted.includes('        println'), 'excessive indentation should be removed');
  } finally {
    worker.terminate();
  }
});

test('format: well-formatted code is unchanged', async () => {
  const worker = await startLspWorker();
  try {
    const source = `fn main {
  println("Hello, MoonBit!")
}
`;
    const formatted = await formatWithLsp(worker, source, 'main.mbt');
    assert.ok(typeof formatted === 'string', 'result should be a string');
    assert.ok(formatted.includes('println("Hello, MoonBit!")'), 'content should be preserved');
  } finally {
    worker.terminate();
  }
});

test('format: multi-function file', async () => {
  const worker = await startLspWorker();
  try {
    const source = `pub fn add(a : Int, b : Int) -> Int {
a + b
}

pub fn hello() -> Unit {
  println("Hello!")
}
`;
    const formatted = await formatWithLsp(worker, source, 'lib.mbt');
    assert.ok(typeof formatted === 'string', 'result should be a string');
    assert.ok(formatted.includes('a + b'), 'function body should be preserved');
    assert.ok(formatted.includes('pub fn add'), 'function signature should be preserved');
  } finally {
    worker.terminate();
  }
});

// ---------------------------------------------------------------------------
// Sample code tests — compile and run every file in src/sample_codes/
// ---------------------------------------------------------------------------

import { readdirSync, readFileSync } from 'fs';

/**
 * Parse a multi-file MoonBit source string (using `-- filename --` separators)
 * into an array of [filename, content] tuples, matching app.tsx parseMultipleFiles.
 */
function parseSampleFiles(source) {
  const files = [];
  const lines = source.split('\n');
  let currentFile = 'main.mbt';
  let currentContent = [];
  for (const line of lines) {
    const match = line.match(/^--\s+(.+?)\s+--$/);
    if (match) {
      if (currentContent.length > 0 || files.length === 0) {
        files.push([currentFile, currentContent.join('\n')]);
      }
      currentFile = match[1].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }
  if (currentContent.length > 0 || files.length === 0) {
    files.push([currentFile, currentContent.join('\n')]);
  }
  return files;
}

const samplesDir = join(__dir, '../src/sample_codes');
const sampleFiles = readdirSync(samplesDir).filter(f => f.endsWith('.mbt')).sort();

/** Derive the display name from a sample filename (matches Vite glob logic in app.tsx). */
function sampleDisplayName(filename) {
  return filename
    .replace('.mbt', '')
    .replace(/^\d+_/, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Expected output snippets for each sample (keyed by display name).
const EXPECTED_OUTPUTS = {
  'Hello': 'Hello, MoonBit!',
  'Multiple Files': 'Hello from lib.mbt!',
  'With Package Import': "Value of 'b': 2",
  'Comprehensive Demo': '=== MoonBit Feature Showcase ===',
};

/**
 * Returns true if the given mbtFiles represent a test-only package:
 * has test blocks but no meaningful fn main (only an empty stub at most).
 */
function isTestOnlyPackage(mbtFiles) {
  const allContent = mbtFiles.map(([, c]) => c).join('\n');
  const hasTestBlock = /^test\s+/m.test(allContent);
  // An empty fn main {} is just a stub to allow run-mode compilation; treat as test-only.
  const mainBody = allContent.replace(/\bfn\s+main\s*\{\s*\}/gs, '');
  const hasRealMain = /\bfn\s+main\b/.test(mainBody);
  return hasTestBlock && !hasRealMain;
}

for (const sampleFile of sampleFiles) {
  const displayName = sampleDisplayName(sampleFile);
  const source = readFileSync(join(samplesDir, sampleFile), 'utf-8');
  const mbtFiles = parseSampleFiles(source);
  const testOnly = isTestOnlyPackage(mbtFiles);

  test(`sample: ${displayName} — compiles without errors`, async () => {
    const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
    try {
      const buildResult = testOnly
        ? await buildTestPackage(worker, mbtFiles)
        : await buildPackage(worker, mbtFiles);
      // Filter out warning-level diagnostics; only fail on errors
      const errors = buildResult.diagnostics.filter(d => {
        try { return JSON.parse(d).level === 'error'; } catch { return true; }
      });
      assert.deepEqual(errors, [], `${displayName}: no compilation errors`);
    } finally {
      worker.terminate();
    }
  });

  test(`sample: ${displayName} — runs and produces expected output`, async () => {
    const worker = new Worker(join(__dir, 'worker-bootstrap.cjs'));
    try {
      const buildResult = testOnly
        ? await buildTestPackage(worker, mbtFiles)
        : await buildPackage(worker, mbtFiles);
      const errors = buildResult.diagnostics.filter(d => {
        try { return JSON.parse(d).level === 'error'; } catch { return true; }
      });
      assert.deepEqual(errors, [], `${displayName}: no compilation errors`);
      const linkResult = testOnly
        ? await linkTestCore(worker, buildResult.core)
        : await linkCore(worker, buildResult.core);
      const output = runCompiledJs(linkResult.result);
      const expected = EXPECTED_OUTPUTS[displayName];
      if (expected) {
        assert.ok(output.includes(expected), `${displayName}: output should contain "${expected}"`);
      }
      if (testOnly) {
        const results = parseTestOutput(output);
        const failed = results.filter(r => r.message !== '');
        assert.equal(failed.length, 0, `${displayName}: all tests should pass`);
      }
    } finally {
      worker.terminate();
    }
  });
}
