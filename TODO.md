# TODO - MoonBit Online MVP

## ✅ 完了: 標準ライブラリ統合

- [x] printlnを機能させる
  - [x] 標準ライブラリ(.mi)ファイルの取得方法を調査
  - [x] moon CLIのインストール
  - [x] 標準ライブラリファイルの配置
  - [x] バージョン互換性の問題を解決
  - [x] moonpad-monacoのcompile関数を使用してJS出力方式に切り替え
  
  **解決策**: moonbit-tourと同じ方法を採用
  - Workerファイルを`new Worker('/moonc-worker.js')`で直接参照
  - node_modules/@moonbit/moonpad-monaco/dist/から必要なファイルをpublic/にコピー
  - バージョンを0.1.202510171に合わせる
  - JS出力方式により標準ライブラリが自動的に含まれる

## Phase 1: コンパイラ起動検証 (技術的PoC)

- [x] プロジェクトの基本セットアップ
  - [x] Vite + PReact + TypeScript環境の構築
  - [x] 必要な依存パッケージのインストール
    - [x] `@moonbit/moonc-worker`
    - [x] `comlink`
    - [x] `pico.css`
  - [x] 基本的なディレクトリ構造の作成

- [x] moonc.wasm のブラウザ動作検証
  - [x] `@moonbit/moonc-worker` のインポートとWorker起動確認
  - [x] comlinkによるWorkerラッパーの実装
  - [x] ハードコードされた "Hello World" のコンパイル成功
  - [x] WASMバイナリの取得確認
  - [x] コンソールにコンパイル成功ログが出ることの確認

## Phase 2: ランタイム接続

- [x] JS実行環境の構築（WASMからJSに変更）
  - [x] moon.run() による実行
  - [x] ReadableStreamからの出力取得
  - [x] 標準出力のキャプチャ機能の実装
  - [x] MoonBit標準ライブラリの自動的な利用
  - [x] "Hello World" 実行結果のJSでの取得確認

## Phase 3: UI構築 & 統合

- [x] PReact + Pico.css でのUI作成
  - [x] Header コンポーネント（タイトル、GitHubリンク）
  - [x] Editor Area コンポーネント（textarea）
  - [x] Action Bar コンポーネント（Runボタン、共有ボタン）
  - [x] Output Area コンポーネント（コンパイルエラー、実行結果表示）
  - [x] ダークモードの設定

- [x] UIとWorkerの接続
  - [x] エディタからWorkerへのコード送信
  - [x] Workerからの結果受信と表示
  - [x] エラーハンドリング
  - [x] ローディング状態の表示

- [x] URL共有機能
  - [x] ソースコードのBase64エンコード実装
  - [x] URLハッシュへの埋め込み
  - [x] ページロード時のハッシュからのコード復元
  - [x] 共有ボタンの実装

## テスト・検証

- [x] 基本動作確認
  - [x] Hello Worldプログラムのコンパイル・実行
  - [x] コンパイルエラーの適切な表示
  - [x] 標準出力の正常な表示
  - [x] printlnの動作確認
  - [x] 文字列補間の動作確認
  - [x] 配列の表示確認

- [x] ブラウザ動作確認
  - [x] Chrome DevTools MCPを使った動作確認
  - [x] モバイルデバイスでの表示確認
  - [x] ダークモードの動作確認

## ドキュメント

- [x] README.mdの更新
  - [x] セットアップ手順
  - [x] 使い方
  - [x] 技術スタック
  - [x] 開発手順
