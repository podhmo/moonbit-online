# コードフォーマット機能 実装ガイド

このドキュメントは、MoonBit Online にコードフォーマット機能を追加する際に行った調査・意思決定の記録です。

---

## 調査結果

### 利用可能なフォーマット手段の調査

MoonBit のフォーマット機能を実現するために、以下の3つのパッケージを調査しました。

| パッケージ | サイズ | フォーマット機能 |
|---|---|---|
| `@moonbit/moonpad-monaco` | ~9 MB | なし（型定義に `compile`, `run`, `test` のみ） |
| `@moonbit/moonc-worker` | ~4 MB | なし（`buildPackage`, `linkCore`, `check`, `genTestInfo` のみ） |
| `@moonbit/analyzer` | ~3.6 MB | **あり**（LSP サーバー、`textDocument/formatting` をサポート） |

#### `@moonbit/moonc-worker` の調査

`moonc-web.d.ts` を確認したところ、フォーマット API は存在しませんでした。コンパイラの Comlink ディスパッチテーブルには `check`, `buildPackage`, `linkCore`, `genTestInfo` の4つのみが登録されています。

#### `@moonbit/analyzer` の調査

`lsp-server.js`（~3.6 MB、OCaml コンパイラを JS にコンパイルしたもの）の内部を調査したところ、LSP の `textDocument/formatting` リクエストを処理するハンドラが存在することを確認しました。

```js
// lsp-server.js 内部の実装（抜粋・難読化解除後）
N.onDocumentFormatting(({ textDocument: Q }) => {
  let r0 = V.get(Q.uri);
  if (r0 === undefined) return null;
  let j = r0.getText(), B0;
  if (Q.uri.endsWith("moon.pkg")) {
    B0 = formatter.formatMoonPkg(j);
  } else if (r0.languageId === "moonbit") {
    B0 = formatter.format(j, true);
  }
  return B0 === undefined ? null : [{
    range: { start: r0.positionAt(0), end: r0.positionAt(j.length) },
    newText: B0
  }];
});
```

フォーマットは**純粋に構文的な操作**であり、型情報や stdlib へのアクセスは不要です。

---

## LSP サーバーの起動シーケンス調査

`lsp-server.js` の起動には以下のシーケンスが必要です：

### 1. Comlink ポートの受け渡し

LSP サーバーは起動時に `self.addEventListener('message', ...)` で最初のメッセージを待ちます。そのメッセージには `{ moonbitEnv, port }` が含まれており、`port` は `MessageChannel.port2` を `event.ports[0]` で受け取ります。

この `port` は LSP サーバーが Comlink を通じてファイルシステム操作を呼び出すために使用します（主に stdlib ファイルの読み込み）。

### 2. `initialize` リクエスト

Comlink ポートを受け取った後、LSP サーバーは通常の LSP プロトコルを `self.onmessage` で受け付けます（`addEventListener` ではなく `onmessage` プロパティへの代入を使用する点に注意）。

### 3. フォーマットの流れ

```
[Main Thread] → postMessage({ moonbitEnv, _lsp_port: port2 }, [port2])
[LSP Worker]  ← 起動、Comlink FS 呼び出しを port2 経由で主スレッドへ
[Main Thread] → FS 呼び出しにエラーで応答（フォーマットには stdlib 不要）
[Main Thread] → postMessage({ jsonrpc, id:1, method: "initialize", ... })
[LSP Worker]  → postMessage({ jsonrpc, id:1, result: { capabilities: ... } })
[Main Thread] → postMessage({ jsonrpc, method: "initialized", ... })
[Main Thread] → postMessage({ jsonrpc, method: "textDocument/didOpen", ... })
[Main Thread] → postMessage({ jsonrpc, id:N, method: "textDocument/formatting", ... })
[LSP Worker]  → postMessage({ jsonrpc, id:N, result: [{ range, newText }] })
```

---

## 意思決定

### 意思決定1: LSP サーバーを使う vs 独自実装

**決定**: `@moonbit/analyzer/lsp-server.js` の LSP サーバーを使用する。

**理由**:
- 公式のフォーマッターを使うことで、`moonbit fmt` コマンドと同等の結果が得られる
- 独自実装は現実的でない（MoonBit の構文解析器を JS で書き直す必要がある）
- `lsp-server.js` はすでに `@moonbit/moonpad-monaco` の依存として `node_modules` に存在する

### 意思決定2: Comlink FS の扱い

**決定**: すべての Comlink FS 呼び出しにエラーで応答する。

**理由**:
- フォーマットは構文的な操作であり、stdlib の型情報・MI ファイルは不要
- `addCore()` が失敗してもフォーマット機能は正常に動作することを確認済み
- エラー応答することで、`addCore()` が stdlib ファイルを待ち続けるのを防ぎ、初期化を速く完了させられる

### 意思決定3: `///|` マーカーの処理

**決定**: 元のソースに `///|` がない場合は、フォーマット結果の先頭の `///|\n` を除去する。

**理由**:
- MoonBit LSP フォーマッターは常に `///|`（カーソル位置マーカー）を先頭に付加する
- エディタで Monaco Editor を使用していない本プロジェクトでは、このマーカーはユーザーに見えるべきではない
- `///|` で始まるコードを書いたユーザーの場合はそのまま保持する

### 意思決定4: postinstall での `lsp-server.js` のコピー

**決定**: `package.json` の `postinstall` スクリプトで `lsp-server.js` を `public/` にコピーする。

**理由**:
- 既存の `moonc-worker.js` と同じパターン（`postinstall` → `public/` → ブラウザから `/lsp-server.js` でアクセス）
- `public/` は `.gitignore` に含まれているため、生成物はリポジトリに含まれない

### 意思決定5: `formatter.ts` を動的インポートで遅延ロードする

**決定**: `app.tsx` で `formatter.ts` を静的インポートせず、Format ボタンが**初めて押下されたタイミング**で動的 `import('./formatter')` で読み込む。

```ts
const handleFormat = async () => {
  const { formatCode } = await import('./formatter');
  // ...
};
```

**理由**:
- `lsp-server.js` は ~3.6 MB の大きなファイルで、フォーマット機能を使わないユーザーには不要
- 動的インポートにより、Vite は `formatter.ts` とその依存を別チャンクに分割し、初期ロードから除外する
- Format ボタン押下時の初回のみ追加コストが発生するが、以降は Worker がキャッシュされるため高速
- `ensureWorker()` 内の Worker インスタンス自体も遅延生成（初回 `formatCode()` 呼び出し時のみ）されるため、モジュールロードと Worker 起動の両方が遅延する

---

## 遭遇したアクシデント

### アクシデント1: `BrowserMessageReader` が `onmessage` プロパティを使用する

**問題**: LSP サーバーの `BrowserMessageReader` は `addEventListener('message', ...)` ではなく `self.onmessage = handler` という代入を使用していた。Node.js テスト環境の Web Worker ポリフィル（`lsp-worker-bootstrap.cjs`）に `addEventListener` しかポリフィルしていなかったため、ワーカーが起動直後に終了する問題が発生した。

**解決**: `Object.defineProperty(globalThis, 'onmessage', { set: ... })` でプロパティへの代入を横取りして `parentPort.on('message', ...)` に転送するようにした。

### アクシデント2: `_lsp_port` の受け渡し方法

**問題**: Web Worker のブラウザ環境では、`postMessage(data, [port])` で渡したポートは `MessageEvent.ports[0]` で受け取れる。しかし Node.js の `worker_threads` では Transferable の転送メカニズムが違い、`event.ports` が存在しない。

**解決**: 送信側（テストコード）がポートをメッセージの特殊キー `_lsp_port` に格納し、受信側ポリフィルがそのキーを抽出して `event.ports[0]` として見せるようにした。

---

## 仕様

### 単一ファイルのフォーマット

エディタのコードが1ファイルの場合（`--` セパレーターなし）、そのまま `main.mbt` としてフォーマットされます。

```
fn main {
println("Hello")
}
↓ Format ボタン押下
fn main {
  println("Hello")
}
```

### 複数ファイルのフォーマット（`-- filename --` 区切り）

エディタが複数ファイルを含む場合、各ファイルを**独立して**フォーマットし、フォーマット後にセパレーターで再連結して返します。

```
fn main {
hello()
}
-- lib.mbt --
pub fn hello() -> Unit {
println("Hello from lib.mbt!")
}
↓ Format ボタン押下
fn main {
  hello()
}
-- lib.mbt --
pub fn hello() -> Unit {
  println("Hello from lib.mbt!")
}
```

#### 複数ファイルの区切り形式

```
-- <ファイル名> --
```

例:
- `-- lib.mbt --`
- `-- utils.mbt --`

この形式は `app.tsx` の `parseMultipleFiles()` および `formatter.ts` の `parseMultiFileSource()` で使用されている共通の形式です。

### フォーマット失敗時の動作

- LSP サーバーの初期化に 15 秒以上かかった場合: エラーをコンソールに出力し、コードは変更されない
- 個別ファイルのフォーマットが 10 秒以内に応答しない場合: タイムアウトし、そのファイルは元のままで返す
- LSP が `null` または空の結果を返した場合: 元のソースをそのまま返す

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/formatter.ts` | フォーマット機能の実装本体（LSP クライアント） |
| `src/app.tsx` | Format ボタンの UI 統合 |
| `test/lsp-worker-bootstrap.cjs` | Node.js テスト用 Web Worker ポリフィル |
| `test/compiler-node.test.mjs` | フォーマット機能の統合テスト（3件） |
| `public/lsp-server.js` | `postinstall` で自動生成（`node_modules/@moonbit/analyzer/` からコピー） |
| `package.json` | `postinstall` でのコピーコマンド追加 |
