# MoonBit Online - プロジェクト情報

## プロジェクト概要

MoonBitのWASMコンパイラを利用したブラウザ上で動作するオンラインプレイグラウンド。
完全にブラウザベースで、サーバーサイド不要でMoonBitコードのコンパイル・実行が可能。

## 技術スタック

### フロントエンド
- **Preact**: 軽量なReact代替ライブラリ
- **TypeScript**: 型安全な開発
- **Vite**: 高速ビルドツール
- **Pico.css v2**: ミニマルCSSフレームワーク（ダークモード対応）

### コンパイラ・実行環境
- **@moonbit/moonpad-monaco@0.1.202510171**: MoonBitコンパイラのラッパー
- **@moonbit/moonc-worker**: MoonBit WASMコンパイラ
- **monaco-editor-core@0.52.0**: エディタコア（将来の拡張用）

### 実行方式
- **JS出力方式**: WASMではなくJavaScriptコードを生成・実行
- **標準ライブラリ自動バンドル**: JS出力により標準ライブラリが自動的に含まれる
- **Worker配置**: moonc-worker.js、lsp-server.js、onig.wasmをpublic/に配置

## アーキテクチャ

### コンパイル・実行フロー

1. ユーザーがMoonBitコードを入力（textarea）
2. `moon.compile()` でJavaScriptコードを生成（debugMain: true）
3. 標準ライブラリが自動的にバンドルされる
4. `moon.run()` でJSコードを実行
5. ReadableStream<string>から出力を取得
6. 画面に表示

### Worker初期化

```typescript
moonbitMode.init({
  onigWasmUrl: '/onig.wasm',
  lspWorker: new Worker('/lsp-server.js'),
  mooncWorkerFactory: () => new Worker('/moonc-worker.js')
})
```

### ビルドプロセス

1. `vite build`: Preact + TypeScriptをビルド
2. `npm run copy-workers`: public/からdist/へworkerファイルをコピー
3. dist/ディレクトリに全ファイルが揃う

## 機能

### 実装済み機能 ✅

- ✅ MoonBitコードのコンパイル（JS出力）
- ✅ コード実行と出力表示
- ✅ println含む標準ライブラリの完全サポート
- ✅ コンパイルエラーの表示
- ✅ URL共有機能（Base64エンコード）
- ✅ レスポンシブデザイン
- ✅ ダークモード対応

### 動作確認済み

```moonbit
fn main {
  println("Hello, MoonBit!")
  let x = 42
  println("x = \{x}")
  let arr = [1, 2, 3, 4, 5]
  println("Array: \{arr}")
}
```

## 技術的な発見

### 重要なポイント

1. **moonbit-tourの実装を参考にした**
   - vendor/moonbit-docs/moonbit-tourのコードが解決の鍵
   - Workerファイルをpublic/に配置し、ルートパスから参照
   - JS出力方式により標準ライブラリが自動的に含まれる

2. **WASMではなくJS出力**
   - 当初はWASM出力を試みたが、標準ライブラリの統合で問題発生
   - JS出力に切り替えることで標準ライブラリが自動的にバンドルされる
   - .miファイルの手動管理が不要

3. **パッケージバージョンの重要性**
   - @moonbit/moonpad-monaco@0.1.202510171
   - monaco-editor-core@0.52.0
   - moonbit-tourと同じバージョンに統一することで動作

## 制限事項

- 📄 **単一ファイルのみ**: 複数ファイルプロジェクトには対応していません
- 🔤 **基本的なエディタ**: シンタックスハイライト、コード補完はありません
- 📦 **パッケージ管理**: 外部ライブラリのインポートはできません

## 今後の拡張案

- Monaco Editorの完全統合（シンタックスハイライト、補完）
- 複数ファイルのサポート
- コード例のプリセット
- エクスポート機能（.mbtファイルのダウンロード）
- 実行時間の測定
- メモリ使用量の表示

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# プロダクションビルド（workerファイル自動コピー）
npm run build

# ビルドのプレビュー
npm run preview
```

## ディレクトリ構造

```
moonbit-online/
├── src/
│   ├── app.tsx          # メインアプリケーションコンポーネント
│   ├── compiler.ts      # MoonBit compiler wrapper (moonpad-monaco)
│   └── main.tsx         # エントリーポイント
├── public/              # 静的ファイル
│   ├── lsp-server.js    # Language Server Worker (3.2MB)
│   ├── moonc-worker.js  # MoonBit Compiler Worker (3.4MB)
│   ├── moonpad-monaco.js # Monaco integration (8.3MB)
│   └── onig.wasm        # Oniguruma WASM (462KB)
├── results/             # 振り返り・スクリーンショット
├── dist/                # ビルド出力
├── index.html           # HTMLテンプレート
├── vite.config.ts       # Vite設定
├── tsconfig.json        # TypeScript設定
├── package.json         # 依存関係とスクリプト
├── TODO.md              # タスクリスト
├── README.md            # ユーザー向けドキュメント
└── info.md              # このファイル（開発者向け情報）
```

## 学習リソース

- [MoonBit公式ドキュメント](https://www.moonbitlang.com/docs/)
- [moonbit-tour実装](https://tour.moonbitlang.com/)
- [@moonbit/moonpad-monaco NPM](https://www.npmjs.com/package/@moonbit/moonpad-monaco)
- [Preact公式サイト](https://preactjs.com/)
- [Vite公式サイト](https://vitejs.dev/)

## 開発履歴

主要な実装フェーズ：
1. Phase 1: コンパイラ起動検証（Vite + Preact + moonc-worker）
2. Phase 2: 実行環境構築（当初はWASM、後にJS出力に変更）
3. Phase 3: UI構築とURL共有機能
4. 標準ライブラリ統合: moonbit-tour方式の採用により成功

詳細は`results/`ディレクトリの振り返りドキュメントを参照。

### Answer
## moonc-worker.jsを直接使用する方法

Monacoエディタなしで`moonc-worker.js`を直接使用し、WASMのMoonbitを実行するには、以下のように実装できます。

### 基本的な使用方法

```typescript
import mooncWorker from "@moonbit/moonc-worker/moonc-worker?worker";
import * as comlink from "comlink";

// Workerを作成してcomlinkでラップ
const worker = new mooncWorker();
const moonc = comlink.wrap<any>(worker);

// Moonbitコードをコンパイル
async function compileMoonbit(sourceCode: string) {
  try {
    const result = await moonc.buildPackage({
      mbtFiles: [["main.mbt", sourceCode]],
      miFiles: [],
      stdMiFiles: [], // 標準ライブラリの.miファイル
      target: "js",
      pkg: "main",
      pkgSources: ["main:main:/"],
      errorFormat: "json",
      isMain: true,
      enableValueTracing: false,
      noOpt: false,
      indirectImportMiFiles: [],
    });
    
    // コアファイルをリンクしてWASMを生成
    const linked = await moonc.linkCore({
      coreFiles: [result.core],
      exportedFunctions: [],
      main: "main",
      outputFormat: "wasm",
      pkgSources: ["main:main:/"],
      sources: {},
      target: "js",
      testMode: false,
      sourceMap: false,
      debug: false,
      noOpt: false,
      sourceMapUrl: "",
      stopOnMain: false,
    });
    
    return linked.result; // Uint8Array (WASM)
  } finally {
    worker.terminate();
  }
}
```

### WASMの実行

生成されたWASMを実行するには：

```typescript
async function runWasm(wasmBytes: Uint8Array) {
  const wasmModule = await WebAssembly.instantiate(wasmBytes);
  const { exports } = wasmModule.instance;
  
  // main関数を呼び出し
  if (exports.main) {
    exports.main();
  }
}

// 使用例
const source = `
pub fn main() {
  println("Hello, Moonbit!")
}
`;

const wasmBytes = await compileMoonbit(source);
await runWasm(wasmBytes);
```

## Notes

- `moonc-worker.js`は`@moonbit/moonc-worker`パッケージからインポートします moonpad-monaco:47-47 
- comlinkを使用してWorkerとの通信を簡素化しています moonpad-monaco:52-53 
- `buildPackage`と`linkCore`関数はmoon.tsでの実装を参考にしています moonpad-monaco:59-69 
- Workerは使用後に必ず`terminate()`を呼び出してリソースを解放してください moonpad-monaco:55-55 

Wiki pages you might want to explore:
- [Multi-threaded Architecture (moonbitlang/moonpad-monaco)](/wiki/moonbitlang/moonpad-monaco#3.2)
- [Language Mode Integration (moonbitlang/moonpad-monaco)](/wiki/moonbitlang/moonpad-monaco#4.2)
### Citations
**File:** moonpad/package.json (L47-47)
```json
    "@moonbit/moonc-worker": "^0.1.202601103",
```
**File:** moonpad/src/moon.ts (L52-53)
```typescript
  const worker = mooncWorkerFactory();
  const moonc = comlink.wrap<any>(worker);
```
**File:** moonpad/src/moon.ts (L55-55)
```typescript
  worker.terminate();
```
**File:** moonpad/src/moon.ts (L59-69)
```typescript
async function mooncBuildPackage(
  params: mooncWeb.buildPackageParams,
): Promise<ReturnType<typeof mooncWeb.buildPackage>> {
  return await moonc(async (moonc) => await moonc.buildPackage(params));
}

async function mooncLinkCore(
  params: mooncWeb.linkCoreParams,
): Promise<ReturnType<typeof mooncWeb.linkCore>> {
  return await moonc(async (moonc) => await moonc.linkCore(params));
}
```
## Q2
web上で完結するようにしたい
### Answer
## Web上で完結するMoonbit WASM実行方法

ブラウザのみでMoonbitをWASMにコンパイルして実行する完全な例です。

### 完全な実装例

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        import mooncWorkerUrl from 'https://unpkg.com/@moonbit/moonc-worker/moonc-worker.js?worker';
        import * as comlink from 'https://unpkg.com/comlink/dist/esm/comlink.mjs';
        
        // 標準ライブラリの読み込み（事前取得が必要）
        async function loadStdLib() {
            // 実際のアプリケーションでは、これらのファイルをホストする必要があります
            const stdLibResponse = await fetch('/path/to/std-lib.mi-files');
            return await stdLibResponse.json();
        }
        
        async function compileAndRunMoonbit() {
            const worker = new Worker(mooncWorkerUrl, { type: 'module' });
            const moonc = comlink.wrap(worker);
            
            try {
                // Moonbitソースコード
                const source = `
pub fn main() -> Int {
    let x = 42
    let y = x * 2
    y
}
`;
                
                // 1. パッケージのビルド
                const buildResult = await moonc.buildPackage({
                    mbtFiles: [['main.mbt', source]],
                    miFiles: [],
                    stdMiFiles: await loadStdLib(), // 標準ライブラリ
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
                    console.error('Compilation failed');
                    return;
                }
                
                // 2. コアファイルのリンク（WASM出力）
                const linkResult = await moonc.linkCore({
                    coreFiles: [buildResult.core],
                    exportedFunctions: ['main'],
                    main: 'main',
                    outputFormat: 'wasm',
                    pkgSources: ['main:main:/'],
                    sources: {},
                    target: 'js',
                    testMode: false,
                    sourceMap: false,
                    debug: false,
                    noOpt: false,
                    sourceMapUrl: '',
                    stopOnMain: false
                });
                
                // 3. WASMの実行
                const wasmModule = await WebAssembly.instantiate(linkResult.result);
                const result = wasmModule.instance.exports.main();
                
                console.log('Result:', result);
                document.getElementById('output').textContent = `Result: ${result}`;
                
            } catch (error) {
                console.error('Error:', error);
            } finally {
                worker.terminate();
            }
        }
        
        // 実行ボタンの設定
        document.getElementById('run').onclick = compileAndRunMoonbit;
    </script>
</head>
<body>
    <button id="run">Run Moonbit</button>
    <div id="output"></div>
</body>
</html>
```

### 必要なリソースの準備

Web上で完結させるには、以下のリソースをホストする必要があります moonpad-monaco:77-79 
- 標準ライブラリファイルは事前に取得してWebサーバーで配信する必要があります moonpad-monaco:77-79 
- WASM出力の場合、`outputFormat: 'wasm'`を指定します moonpad-monaco:201-218 
- Workerは使用後に必ずterminate()を呼び出してください moonpad-monaco:55-55 

Wiki pages you might want to explore:
- [Language Mode Integration (moonbitlang/moonpad-monaco)](/wiki/moonbitlang/moonpad-monaco#4.2)
- [Compilation System (moonbitlang/moonpad-monaco)](/wiki/moonbitlang/moonpad-monaco#4.4)
### Citations
**File:** moonpad/src/moon.ts (L55-55)
```typescript
  worker.terminate();
```
**File:** moonpad/src/moon.ts (L77-79)
```typescript
function getStdMiFiles(): [string, Uint8Array][] {
  return Core.getLoadPkgsParams("js");
}
```
**File:** moonpad/src/moon.ts (L201-218)
```typescript
  const { result, sourceMap } = await mooncLinkCore({
    coreFiles,
    exportedFunctions,
    main: isTest ? "moonpad/lib_blackbox_test" : "moonpad/lib",
    outputFormat: "wasm",
    pkgSources: [
      "moonbitlang/core:moonbit-core:/lib/core",
      "moonpad/lib:moonpad:/",
    ],
    sources,
    target: "js",
    testMode: isTest,
    sourceMap: debugMain,
    debug: debugMain,
    noOpt: debugMain,
    sourceMapUrl: "%%moon-internal-to-be-replaced.map%%",
    stopOnMain: debugMain,
  });
```
## Q3
viteとnode.jsの利用はして良いです。npmを使っても良いです。ただしmoonbitのcompilerはwasmでweb上で呼びたいです。
### Answer
## Vite + Node.jsでMoonbit WASMコンパイラを使用する方法

ViteとNode.js環境でMoonbitのWASMコンパイラをWeb上で使用する完全なセットアップ例です。

### プロジェクトセットアップ

```bash
npm create vite@latest moonbit-wasm-demo -- --template vanilla-ts
cd moonbit-wasm-demo
npm install
npm install @moonbit/moonc-worker comlink
```

### Vite設定 (vite.config.ts)

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['@moonbit/moonc-worker']
  }
});
```

### メイン実装 (src/main.ts)

```typescript
import mooncWorker from '@moonbit/moonc-worker/moonc-worker?worker';
import * as comlink from 'comlink';

// Moonbitコンパイラのラッパー
class MoonbitCompiler {
  async compile(sourceCode: string): Promise<Uint8Array> {
    const worker = new mooncWorker();
    const moonc = comlink.wrap<any>(worker);
    
    try {
      // 1. パッケージをビルド
      const buildResult = await moonc.buildPackage({
        mbtFiles: [['main.mbt', sourceCode]],
        miFiles: [],
        stdMiFiles: [], // 簡略化のため空に
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
        throw new Error('Compilation failed');
      }
      
      // 2. WASMとしてリンク
      const linkResult = await moonc.linkCore({
        coreFiles: [buildResult.core],
        exportedFunctions: ['main'],
        main: 'main',
        outputFormat: 'wasm',
        pkgSources: ['main:main:/'],
        sources: {},
        target: 'js',
        testMode: false,
        sourceMap: false,
        debug: false,
        noOpt: false,
        sourceMapUrl: '',
        stopOnMain: false
      });
      
      return linkResult.result;
    } finally {
      worker.terminate();
    }
  }
  
  async runWasm(wasmBytes: Uint8Array): Promise<any> {
    const wasmModule = await WebAssembly.instantiate(wasmBytes);
    return wasmModule.instance.exports;
  }
}

// 使用例
async function main() {
  const compiler = new MoonbitCompiler();
  
  const source = `
pub fn main() -> Int {
  let x = 42
  let y = x * 2
  y
}
`;
  
  try {
    const wasmBytes = await compiler.compile(source);
    const exports = await compiler.runWasm(wasmBytes);
    const result = exports.main();
    
    console.log('Result:', result);
    document.body.innerHTML = `<h1>Result: ${result}</h1>`;
  } catch (error) {
    console.error('Error:', error);
    document.body.innerHTML = `<h1>Error: ${error}</h1>`;
  }
}

main();
```

### HTML (index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Moonbit WASM Demo</title>
</head>
<body>
  <h1>Moonbit WASM Compiler Demo</h1>
  <div id="output">Loading...</div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

## 実装のポイント

- `@moonbit/moonc-worker`はWASM版のMoonbitコンパイラです moonpad-monaco:47-47 
- Workerは使用後に必ず`terminate()`でリソースを解放します moonpad-monaco:55-55 
- `outputFormat: 'wasm'`でWASM出力を指定します moonpad-monaco:201-218 
- comlinkでWorkerとのRPC通信を簡素化します moonpad-monaco:52-53 

## Notes

- 標準ライブラリを使用する場合は`stdMiFiles`に適切な.miファイルを指定する必要があります moonpad-monaco:77-79 
- Viteのworker設定で`format: 'es'`を指定することでESモジュールとしてWorkerを読み込めます
- より複雑なプロジェクトではmoonpadの仮想ファイルシステム（MFS）も参考になりますが、基本的なコンパイルだけであれば上記の実装で十分です

Wiki pages you might want to explore:
- [Multi-threaded Architecture (moonbitlang/moonpad-monaco)](/wiki/moonbitlang/moonpad-monaco#3.2)
- [Language Mode Integration (moonbitlang/moonpad-monaco)](/wiki/moonbitlang/moonpad-monaco#4.2)
### Citations
**File:** moonpad/package.json (L47-47)
```json
    "@moonbit/moonc-worker": "^0.1.202601103",
```
**File:** moonpad/src/moon.ts (L52-53)
```typescript
  const worker = mooncWorkerFactory();
  const moonc = comlink.wrap<any>(worker);
```
**File:** moonpad/src/moon.ts (L55-55)
```typescript
  worker.terminate();
```
**File:** moonpad/src/moon.ts (L77-79)
```typescript
function getStdMiFiles(): [string, Uint8Array][] {
  return Core.getLoadPkgsParams("js");
}
```
**File:** moonpad/src/moon.ts (L201-218)
```typescript
  const { result, sourceMap } = await mooncLinkCore({
    coreFiles,
    exportedFunctions,
    main: isTest ? "moonpad/lib_blackbox_test" : "moonpad/lib",
    outputFormat: "wasm",
    pkgSources: [
      "moonbitlang/core:moonbit-core:/lib/core",
      "moonpad/lib:moonpad:/",
    ],
    sources,
    target: "js",
    testMode: isTest,
    sourceMap: debugMain,
    debug: debugMain,
    noOpt: debugMain,
    sourceMapUrl: "%%moon-internal-to-be-replaced.map%%",
    stopOnMain: debugMain,
  });
```
