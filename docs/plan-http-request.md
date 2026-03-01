# HTTP Requestサンプル導入の調査メモ

## 結論

- 現状の `moonbit-online` は **WASM実行ではなく JS出力を実行** している。
  - `src/compiler.ts` では `linkCore(..., target: 'js', outputFormat: 'wasm')` を使ってJSコードを生成し、
    `runJs()` でWorker上でそのJSを実行している。
- `@moonbit/moonpad-monaco` から取得できる標準ライブラリ資産は `@moonbitlang/core` 中心で、
  `moonbitlang/async` / `@http` の `.mi` / `.core` は同梱されていない。
- そのため、現状の仕組みのままでは `async fn main` や `@http.get(...)` はそのまま使えない
  （`moonbitlang/async is not imported` / `Package "http" not found` になる）。

## 今回入れた実装（最小変更）

- `src/sample_codes/07_http_request_with_fetch.mbt` を追加。
  - JavaScriptバックエンドの `extern "js"` で `fetch()` を呼ぶサンプル。
  - `data:` URLを使うので外部ネットワーク依存なしで動作確認できる。
- `test/compiler-node.test.mjs` に期待出力を追加し、
  サンプルがコンパイル・実行できることを既存のサンプルテストで検証。
- `README.md` のサンプル一覧に上記サンプルを追記。

## async/httpをcore同様に使えるようにするための今後の方針

1. `moonbitlang/async` と `moonbitlang/async/http` のJSターゲット向け `.mi` / `.core` を
   事前ビルドして配布物に含める。
2. `src/core` と同様に、ロード対象パッケージマップ（async版）を生成する仕組みを追加する。
3. `compileMultiple()` 側で `stdMiFiles` / `linkCore.coreFiles` に async/http を連結できるようにする。
4. `@http.get` を使ったサンプルとテストを追加し、ブラウザ/Nodeの両方で確認する。

現時点では 1,2 の配布資産が不足しているため、先に「JS fetchを使う実行可能サンプル」を追加した。

## 進捗

一応進捗はあるみたい

- https://github.com/moonbitlang/async/pull/302
- https://mooncakes.io/docs/moonbitlang/async/js_async
