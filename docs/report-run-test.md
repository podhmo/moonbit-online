# moon test 実行機能 実装ガイド

このドキュメントは、MoonBit Online に `moon test` 実行機能を追加する際に行った調査・実装・意思決定の記録です。

---

## 概要

`moon test` は MoonBit のテストフレームワークで、`test "name" { ... }` ブロックを実行し `inspect()` などのアサーションを検証します。実装前は Run ボタンのみが存在し、`fn main {}` しか実行できませんでした。

---

## 調査結果

### 依存パッケージの提供する機能

今回の実装に関わるパッケージは以下の通りです：

| パッケージ | 関連 API | 役割 |
|---|---|---|
| `@moonbit/moonc-worker` | `genTestInfo`, `buildPackage`, `linkCore` | コンパイル・リンク本体 |
| `@moonbit/moonpad-monaco` | `compile`, `test` (ブラウザ向け) | 参照実装・テンプレート |

#### `@moonbit/moonc-worker` の `genTestInfo`

`moonc-web.d.ts` に以下の定義があります：

```ts
type genTestInfoParams = {
  mbtFiles: [string, string][];
};

declare function genTestInfo(params: genTestInfoParams): string;
```

`genTestInfo` はテスト用の `.mbt` ファイルを受け取り、テストドライバー（`driver.mbt`）に埋め込む MoonBit コードの断片を返します。返り値は以下のような形式です：

```moonbit
let tests = { "main.mbt": [(__test_6d61696e2e6d6274_0, ["sum"])] }

  let no_args_tests = { "main.mbt": { 0: (__test_6d61696e2e6d6274_0, ["sum"]) } }

  let with_args_tests = { "main.mbt": {} }
  ...
```

この文字列をテンプレートの `// WILL BE REPLACED` プレースホルダーと置換することで、テストドライバーが完成します。

#### `@moonbit/moonpad-monaco` の参照実装

`moonpad-monaco.js` の内部に、テストドライバーのテンプレート（MoonBit ソースコード）が文字列として埋め込まれています。`moon test` の実装に必要な処理フローもここで確認できます：

```
genTestInfo(testFiles)
  → driver.mbt を生成（テンプレート + 置換）
  → buildPackage([...libFiles, ...testFiles, driver.mbt])
  → linkCore(core, { testMode: true, main: "moonpad/lib_blackbox_test" })
  → JS を実行 → 出力を BEGIN/END MOON TEST RESULT で区切られた行単位で解析
```

### テスト出力のプロトコル

テスト実行結果は標準出力に以下の形式で書き出されます：

```
----- BEGIN MOON TEST RESULT -----
{"package": "moonpad/lib", "filename": "main.mbt", "test_name": "sum", "message": ""}
----- END MOON TEST RESULT -----
```

`message` が空文字列の場合はテスト成功、非空の場合はテスト失敗（失敗メッセージ）です。

---

## テンプレートについての詳細

`moonpad-monaco.js` に埋め込まれたテンプレートは `typealias` や `@moonbitlang/core/test.T` の struct リテラルなど、現行の MoonBit コンパイラでは deprecated または非対応の構文を含んでいました。

そのため、`src/compiler.ts` に互換性のある最小テンプレートを独自に用意しました：

- `typealias X = Y` → `type X = Y`（`raise Error` 構文に合わせた新形式）
- `@moonbitlang/core/test.T` の struct リテラル → 削除（with-args テストは不要のため）
- `{BEGIN_MOONTEST}` / `{END_MOONTEST}` / `{PACKAGE}` プレースホルダーは同じ置換方式を維持

---

## 実装の構成

### `src/compiler.ts` への追加

#### `TestResult` インターフェース

```ts
export interface TestResult {
  package: string;
  filename: string;
  test_name: string;
  message: string;
}
```

#### `compileTest(files)` メソッド

1. `callWorker('genTestInfo', { mbtFiles: files })` でテスト登録コードを取得
2. `DRIVER_TEMPLATE` にプレースホルダー置換を行い `driver.mbt` を生成
3. `callWorker('buildPackage', { mbtFiles: [...files, ['driver.mbt', driverContent]], isMain: true, ... })`
4. `callWorker('linkCore', { ..., testMode: true, main: 'moonpad/lib_blackbox_test' })`

`linkCore` の `main` パラメーターは通常実行時の `'moonpad/lib'` と異なり `'moonpad/lib_blackbox_test'` を指定する点が重要です。

#### `runTest(js)` メソッド

`runJs()` で JS を実行した後、出力を行単位で解析して `TestResult[]` を構築します：

```ts
async runTest(js: Uint8Array): Promise<{ output: string; results: TestResult[] }>
```

BEGIN/END デリミタの間の行を JSON としてパースし、それ以外の行を `stdout` として返します。

### `src/sample_codes/05_test.mbt`

イシューに示された `sum` 関数のサンプルを追加しました。ファイル名の先頭数字（`05_`）は既存のサンプルと同じ命名規則に従っています。Vite の `import.meta.glob` が自動的にピックアップし、ドロップダウンに "Test" として表示されます。

### `src/app.tsx` への追加

- `isTesting` state と `handleTest()` ハンドラー
- "Test" ボタン（Run の隣に配置、Run/Test 実行中は両方無効化）
- テスト結果を `✓ PASS` / `✗ FAIL` 形式で Output パネルに表示

---

## 遭遇したアクシデントと見込み違い

### アクシデント1: テンプレートの構文エラー

**問題**: `moonpad-monaco.js` から抽出したテンプレートをそのまま `buildPackage` に渡すと、`typealias X = Y` 構文（deprecated）と `@moonbitlang/core/test.T` の struct リテラルに対してコンパイルエラーが発生しました。

**解決**: 現行の MoonBit コンパイラに対応した最小テンプレートを独自に作成しました。with-args テスト（`@moonbitlang/core/test.T` を使うテスト型）は今回のスコープ外として、no-args テストのみに対応しています。

### アクシデント2: リンク時の `main` パラメーター

**問題**: `linkCore` に `main: 'moonpad/lib'` を指定すると、テストドライバーが実行されずリンクエラーになりました。

**解決**: テストモードでは `main: 'moonpad/lib_blackbox_test'` を指定する必要があることを確認しました（`moonpad-monaco.js` の参照実装より）。

### アクシデント3: JS テンプレートリテラルのエスケープ

**問題**: `moonpad-monaco.js` 内のテンプレート文字列を Node.js 側で解析する際、`\\"` などの JS エスケープシーケンスを適切にデコードする必要がありました。

**解決**: `\\` → `\`、`\\n` → 改行 など JS テンプレートリテラルの展開規則に従ってデコードして確認しました。その後、独自テンプレートでは最初から正しい形で記述することで問題を回避しました。

---

## 意思決定

### 意思決定1: テンプレートの独自実装

**決定**: `moonpad-monaco.js` に埋め込まれたテンプレートを流用せず、最小テンプレートを独自に `compiler.ts` に定義する。

**理由**:
- 依存パッケージのバージョンアップでテンプレートが変わっても自前コードは影響を受けない
- 現行コンパイラに対応した構文のみを使うことでコンパイル警告を最小化できる
- `with-args` テスト（`@moonbitlang/core/test.T`）は今回のスコープ外

### 意思決定2: `genTestInfo` の利用

**決定**: テスト関数の列挙には `buildPackage` の結果を自前で解析せず、専用 API の `genTestInfo` を使用する。

**理由**:
- `genTestInfo` はまさにこの目的のために提供されている API
- `buildPackage` のみでテスト関数名を得ようとすると、コンパイラ内部の命名規則（`__test_<hex>_<index>` 形式）に依存することになり脆弱

### 意思決定3: `runJs` の再利用

**決定**: テスト用 JS の実行に `runJs()` をそのまま利用し、その出力を `runTest()` でパースする。

**理由**:
- テスト実行 JS も通常実行 JS もブラウザの Blob Worker で実行する点は同じ
- デリミタ付き出力のパースはシンプルな文字列処理で対応できる

---

## 残課題

- **with-args テスト** (`test "name"(T) { ... }` 形式) への対応
- テスト出力の JSON に含まれる `@EXPECT_FAILED` 構造体をより読みやすく整形する表示
- 複数ファイルにまたがるテストの動作確認

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/compiler.ts` | `compileTest()`, `runTest()`, `TestResult` の実装 |
| `src/app.tsx` | Test ボタンの UI 統合、`handleTest()` |
| `src/sample_codes/05_test.mbt` | Test サンプルコード |
| `test/compiler-node.test.mjs` | テストモードの統合テスト（2件追加） |
