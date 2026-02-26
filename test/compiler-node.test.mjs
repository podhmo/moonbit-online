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
