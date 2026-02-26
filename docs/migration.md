# Migration Guide: `@moonbit/moonpad-monaco` バージョンアップ手順

このドキュメントは `@moonbit/moonpad-monaco` のバージョンアップ作業（`0.1.202510171` → `0.1.202602253`）で得た知識をまとめ、次回以降の作業者が同じ落とし穴にはまらないようにするためのものです。

---

## パッケージ構成の理解（事前に知っていれば良かった知識）

`@moonbit/moonpad-monaco` は以下の3つの npm パッケージから構成されています：

| パッケージ | サイズ | 内容 |
|---|---|---|
| `@moonbit/moonpad-monaco` | ~9 MB | 以下2つのラッパー + Monaco Editor 統合 + **stdlib 全データ（Base64埋め込み）** |
| `@moonbit/moonc-worker` | ~4 MB | OCaml製コンパイラを WASM にコンパイルした本体。stdlib データは**持たない** |
| `@moonbit/analyzer` | ~数 MB | LSP サーバー (`lsp-server.js`) |

`moonpad-monaco.js` に内包されているデータ：
- **MI ファイル**: JS ターゲット用 stdlib インターフェースファイル（バージョン `0.1.202602253` では66個）
- **ソースファイル**: stdlib の `.mbt` ソース（502個、LSP 用）
- **`core.core.gz`**: pre-linked stdlib バイナリ（`linkCore` に渡す）
- **`all_pkgs.json`**: stdlib パッケージ一覧（Base64 JSON）

重要なのは **`moonc-worker.js` はコンパイラ本体のみで stdlib データを持たない**点です。  
`buildPackage` / `linkCore` に渡す `stdMiFiles` / `coreFiles` は呼び出し側が用意する必要があります。  
このプロジェクトではそれを `postinstall` 時に `moonpad-monaco.js` から抽出し `src/core/core-map.js` に生成することで解決しています。

---

## バージョンアップ手順

### 1. `package.json` のバージョンを更新

```json
"@moonbit/moonpad-monaco": "0.1.202602253"
```

### 2. `npm install` を実行

`postinstall` フックにより以下が自動実行されます：

```sh
mkdir -p public && cp node_modules/@moonbit/moonpad-monaco/dist/*.js node_modules/@moonbit/moonpad-monaco/dist/*.wasm public/
node scripts/generate-core-map.mjs
```

`generate-core-map.mjs` は `public/moonpad-monaco.js` から MI ファイルと `core.core.gz` を抽出し、`src/core/core-map.js` を**自動生成**します。

### 3. `generate-core-map.mjs` の正規表現パターンを確認

このスクリプトは `moonpad-monaco.js` の**内部変数名**に依存した正規表現でデータを抽出しています。バージョンが上がるとミニファイ後の変数名やデータ構造が変わる可能性があります。

`npm install` 後にスクリプトがエラーなく完了するか確認してください：

```sh
node scripts/generate-core-map.mjs
# 正常終了例: Generated .../src/core/core-map.js (66 MI files, core.core.gz: XXXX KB compressed)
```

エラーが出た場合、`moonpad-monaco.js` の構造が変わっています（→「遭遇したアクシデント」参照）。

### 4. `moonc-worker.js` の API 変更を確認

`node_modules/@moonbit/moonc-worker/moonc-web.d.ts` を見て `buildPackage` / `check` / `linkCore` の型定義を確認してください。パラメータが増減している場合は `src/compiler.ts` と `test/compiler-node.test.mjs` を更新します。

### 5. テストを実行

```sh
npm test
```

### 6. バージョン表示を確認

`vite.config.ts` が `package.json` のバージョンを読み取り `__MOONPAD_VERSION__` としてビルド時に注入します。`npm run dev` で UI のタイトル下にバージョンが表示されることを確認してください。

---

## 遭遇したアクシデント

### アクシデント1: `moonpad-monaco.js` の内部構造が変わっていた

`generate-core-map.mjs` はミニファイされた `moonpad-monaco.js` から正規表現でデータを抽出しますが、バージョンアップで変数名・構造が変わっていました：

| 項目 | `0.1.202510171` (旧) | `0.1.202602253` (新) |
|---|---|---|
| stdlib パッケージ一覧 | `Bs = ["abort", "array", ...]` という配列リテラル | `X[".../all_pkgs.json"] = Q("base64json")` という Base64 JSON |
| MI ファイルのパス | `Y["/lib/core/target/js/..."]` | `X["/lib/core/_build/js/..."]` |
| データ取得関数名 | `Q(...)` | 同じく `Q(...)` （互換） |

**修正方法**:
- `all_pkgs.json` の Base64 エントリを探して JSON をデコードし `packages[].rel` から一覧を取得するように変更
- パスの正規表現を `target/js` → `_build/js` に変更

### アクシデント2: `buildPackage` に新パラメータが追加されていた

`moonc-worker.js` の `buildPackage` API に `indirectImportMiFiles` パラメータが追加されており（型定義で必須）、渡さないと実行時エラーになりました。

**修正方法**: `src/compiler.ts` と `test/compiler-node.test.mjs` に `indirectImportMiFiles: []` を追加。

---

## 検討したがあきらめたこと

### `@moonbit/moonpad-monaco` を完全に除去して `@moonbit/moonc-worker` のみ使う

**動機**: Monaco Editor や LSP の機能は不要なのでより軽量な `moonc-worker` だけ直接使いたい。

**断念した理由**: `moonc-worker.js` にはコンパイラ本体しか含まれておらず、stdlib の MI ファイル・`core.core.gz` が入っていません。これらは現在 `moonpad-monaco.js` からのみ取得できます。

**注意**: `moonpad-monaco.js` はブラウザには配信されていません（`postinstall` 時のデータ抽出にのみ使用）。ブラウザに配信されているのは：
- `moonc-worker.js` (コンパイラ本体、~4 MB)
- `src/core/core-map.js` (生成された stdlib データ、インライン Base64)

つまり **不要な Monaco/LSP 関連コードはすでにブラウザには送られていない**状態です。

**将来の代替案** (参考):
1. `moonbitlang/core` リポジトリの GitHub Releases から JS ターゲット向けビルドアーティファクトを取得する CI を組む
2. `moon` CLI を CI に別途インストールして stdlib をビルドする

---

## 変更ファイル一覧（`0.1.202510171` → `0.1.202602253`）

| ファイル | 変更理由 |
|---|---|
| `package.json` | バージョン更新 |
| `package-lock.json` | `npm install` による自動更新 |
| `scripts/generate-core-map.mjs` | 内部データ構造変更への対応 |
| `src/core/index.js` | MI ファイルのパス変更 (`target/js/` → `_build/js/`) |
| `src/compiler.ts` | `indirectImportMiFiles: []` パラメータ追加 |
| `test/compiler-node.test.mjs` | `indirectImportMiFiles: []` パラメータ追加 |
| `vite.config.ts` | ビルド時バージョン定数 `__MOONPAD_VERSION__` を注入 |
| `src/app.tsx` | タイトル下にバージョン表示を追加 |
| `src/core/core-map.js` | `npm install` (`generate-core-map.mjs`) により自動生成 |
