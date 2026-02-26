# moon test 実行 — 意思決定・仕様・見込み違いの記録

このドキュメントは `moon test` 実行機能（`compileTest` / `runTest`）の実装における意思決定・仕様・見込み違いを記録します。  

---

## 実装の仕様

### コンパイルフロー

```
compileTest(files)
  1. genTestInfo({ mbtFiles: files })
       → テスト関数の登録コード（MoonBit 断片）を取得
  2. DRIVER_TEMPLATE + 置換 → driver.mbt を生成
  3. buildPackage({ mbtFiles: [...files, driver.mbt], isMain: true, pkg: 'moonpad/lib', ... })
       → package.core を取得
  4. linkCore({ coreFiles: [coreCore, pkg.core], testMode: true, main: 'moonpad/lib_blackbox_test', ... })
       → 実行可能 JS（Uint8Array）を取得
```

通常 `run` との差は以下の 2 点のみです：

| | `compileMultiple` (run) | `compileTest` (test) |
|---|---|---|
| `mbtFiles` | ユーザーファイルのみ | ユーザーファイル + `driver.mbt` |
| `linkCore.testMode` | `false` | `true` |
| `linkCore.main` | `"moonpad/lib"` | `"moonpad/lib_blackbox_test"` |

### テスト出力プロトコル

テスト実行 JS は標準出力（`println`）を以下のデリミタで囲んで 1 件ずつ結果を書き出します：

```
----- BEGIN MOON TEST RESULT -----
{"package":"moonpad/lib","filename":"main.mbt","test_name":"sum","message":""}
----- END MOON TEST RESULT -----
```

`message` が空文字列 → 成功、非空 → 失敗（失敗理由）。  
`runTest()` はこの出力を行単位で解析し、デリミタ外の行は `stdout` として返します。

### テストドライバーテンプレート

`genTestInfo` の返り値（テスト登録コード）を `DRIVER_TEMPLATE` 内の `// WILL BE REPLACED` プレースホルダーに置換することで `driver.mbt` を生成します。

プレースホルダーは 3 行が組になっています：

```moonbit
let tests = {  } // WILL BE REPLACED
let no_args_tests = {  } // WILL BE REPLACED
let with_args_tests = {  } // WILL BE REPLACED
```

---

## 意思決定

### 決定1: テンプレートを自前で保持する

`@moonbit/moonpad-monaco` パッケージのバンドル（`moonpad-monaco.js`）内にテストドライバーテンプレートが埋め込まれていますが、それを実行時に取り出して使う実装はしませんでした。代わりに `src/compiler.ts` の `DRIVER_TEMPLATE` 定数として独自に保持しています。

**理由**: パッケージ内部の文字列は公開 API ではなく、将来のバージョンで変更・削除されるリスクがあります。また、現行バンドルのテンプレートは deprecated 構文を含んでいるためそのままでは使えません（後述）。

### 決定2: no-args テストのみを対象とする

MoonBit のテストは引数なし（`test "name" { ... }`）と引数あり（`test "name"(T) { ... }`）の 2 種類があります。今回は no-args テストのみを実装対象としました。

**理由**: with-args テストは `@moonbitlang/core/test.T` 型のインスタンスを受け取りますが、この型は現行コンパイラで abstract になっており struct リテラルで生成できません。ドライバー内でインスタンスを生成する方法が現時点では不明のため、スコープ外としました。

### 決定3: `runJs()` を再利用する

テスト用 JS も通常実行 JS も同じ Blob Worker で実行するため、`runTest()` は内部で `runJs()` を呼び出し、その出力をパースします。

---

## 見込み違いと対応

### 見込み違い1: `moonpad-monaco` のテンプレートがそのまま使える

**見込み**: `moonpad-monaco.js` に埋め込まれたドライバーテンプレートを抽出してそのまま `buildPackage` に渡せると思っていました。

**実際**: バンドルのテンプレートは旧構文で書かれており、現行の MoonBit コンパイラ（`@moonbit/moonc-worker` に同梱）でコンパイルするとエラーになりました：

- `typealias X = Y` 構文 → `type X = Y` が正しい現行構文
- `@moonbitlang/core/test.T { ... }` struct リテラル → 現行では abstract 型であり struct リテラルは使用不可

**対応**: 現行コンパイラに対応した最小テンプレートを独自に記述しました。  

**アップストリームへの期待**: `@moonbit/moonpad-monaco` のテンプレートは現在も MoonBit 本体の変更に追従して更新が続いています（[moonbitlang/moonpad-monaco の template.mbt](https://github.com/moonbitlang/moonpad-monaco/blob/a4c718758f653fa86c226f73ba0972a8e9825c58/moonpad/src/template.mbt) 参照）。パッケージが更新され、テンプレートが公開 API として外部から参照できるようになれば、自前保持をやめてパッケージのテンプレートを使う方式に移行できます。それまでは、`@moonbit/moonc-worker` のバージョンアップ時にテンプレートのコンパイルが失敗しないか確認する必要があります。

### 見込み違い2: with-args テストにも対応できる

**見込み**: `test "name"(T) { ... }` 形式にも no-args テストと同様に対応できると思っていました。

**実際**: `@moonbitlang/core/test.T` が abstract 型のため、ドライバー内で `T` のインスタンスを生成する方法がわかりませんでした。`genTestInfo` の返り値には `with_args_tests` エントリが含まれますが、ドライバー側でそれを呼び出すためのコードを書けない状態です。

**対応**: `with_args_tests` を `ignore()` して、現在は no-args テストのみを実行するようにしました。

**アップストリームへの期待**: `moonpad-monaco` の参照実装（[`moon.ts` L95 付近](https://github.com/moonbitlang/moonpad-monaco/blob/52238c8437aecd8a8df0cdb3afd2836a999baae5/moonpad/src/moon.ts#L95)）では `testInputs` に相当する入力ファイルが渡されており、with-args テストの仕組みが実装されているはずです。パッケージがアップデートされてテンプレートが修正されるか、`@moonbitlang/core/test.T` の生成方法が文書化されれば対応を追加できます。

---

## 2026-02 追加: Test ボタン時 warning ノイズ対応の振り返り（PR #51）

### 何が起きていたか

`genTestInfo` の出力には `with_bench_args_tests` / `async_tests` / `async_tests_with_args` が含まれますが、当リポジトリの `DRIVER_TEMPLATE` はそれらを利用していませんでした。  
結果として `moonpad:/driver.mbt` 側で `unused_value` と `unresolved_type_variable` が連続して出力され、ユーザーコード由来の warning と混ざって判別しづらくなっていました。

### 今回の意思決定（自前で書いた部分）

`src/compiler.ts` で以下を実装しました（テスト側は `test/compiler-node.test.mjs` のヘルパーを同等更新）:

- `normalizeGeneratedTestInfo()` を追加し、現行ドライバーで使わない map 宣言を削除してからテンプレートに埋め込む
- `tests` / `no_args_tests` / `with_args_tests` の型を明示する helper 呼び出しをテンプレートへ追加
- `Failure::Failure` / `InspectError::InspectError` の明示コンストラクタ記法へ変更
- `@moonbitlang/core/test.T` を `@moonbitlang/core/test.Test` に更新

### なぜこの対応が必要だったか

- warning の主因がユーザーコードではなく `driver.mbt` 生成側にあったため
- 現行 MoonBit では、暗黙推論に頼る map の束縛や暗黙コンストラクタ利用が warning 化されやすいため
- Test ボタン利用時に「ユーザーが直すべき warning」を見分けやすくする必要があったため

### upstream をそのまま使えるようにするための条件

自前ロジックを減らすには、以下が揃うことが必要です。

1. `@moonbit/moonpad-monaco` からテストドライバーテンプレートを公開 API として参照できること
2. そのテンプレートが `@moonbit/moonc-worker` 同梱コンパイラと同じリリースサイクルで更新されること
3. `genTestInfo` の出力 contract（使う map 名・型）がテンプレートと一緒に固定されること

この 3 点が満たされれば、当リポジトリの自前実装（`DRIVER_TEMPLATE` と `normalizeGeneratedTestInfo()`）は削除して upstream 参照に置き換えられます。

---

## 残課題

| 課題 | 内容 | アップストリーム依存 |
|---|---|---|
| with-args テスト対応 | `test "name"(T) { ... }` 形式の実行 | `@moonbitlang/core/test.T` の生成方法が必要 |
| テンプレートの保守 | `@moonbit/moonc-worker` バージョンアップ時にコンパイル確認が必要 | テンプレートが公開 API になれば不要 |
| 失敗メッセージの整形 | `@EXPECT_FAILED` を含む JSON をより読みやすく表示 | 不要 |
| 複数ファイルのテスト | 複数 `.mbt` ファイルにまたがるテストの動作確認 | 不要 |

---

## 関連ファイル

| ファイル | 役割 |
|---|---|
| `src/compiler.ts` | `DRIVER_TEMPLATE`, `compileTest()`, `runTest()`, `TestResult` |
| `src/app.tsx` | Test ボタン、`handleTest()` |
| `src/sample_codes/05_test.mbt` | テスト用サンプルコード（`sum` 関数 + `test "sum"` ブロック） |
| `test/compiler-node.test.mjs` | テストモードの統合テスト（成功・失敗 各1件） |
