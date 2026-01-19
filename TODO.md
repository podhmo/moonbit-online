# TODO - MoonBit Online MVP

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

- [x] WASM実行環境の構築
  - [x] `WebAssembly.instantiate` による実行ローダーの実装
  - [x] 標準出力のキャプチャ機能の実装
    - [x] `spectest.print_char` などのフック実装
  - [x] MoonBit標準ライブラリの必要な外部関数提供
  - [x] "Hello World" 実行結果のJSでの取得確認

## Phase 3: UI構築 & 統合

- [ ] PReact + Pico.css でのUI作成
  - [ ] Header コンポーネント（タイトル、GitHubリンク）
  - [ ] Editor Area コンポーネント（textarea）
  - [ ] Action Bar コンポーネント（Runボタン、共有ボタン）
  - [ ] Output Area コンポーネント（コンパイルエラー、実行結果表示）
  - [ ] ダークモードの設定

- [ ] Web Workerの統合
  - [ ] Worker用のファイル作成
  - [ ] Phase 1/2 のロジックをWorkerへ移動
  - [ ] comlink を使った型安全なメッセージング実装

- [ ] UIとWorkerの接続
  - [ ] エディタからWorkerへのコード送信
  - [ ] Workerからの結果受信と表示
  - [ ] エラーハンドリング
  - [ ] ローディング状態の表示

- [ ] URL共有機能
  - [ ] ソースコードのBase64エンコード実装
  - [ ] URLハッシュへの埋め込み
  - [ ] ページロード時のハッシュからのコード復元
  - [ ] 共有ボタンの実装

## テスト・検証

- [ ] 基本動作確認
  - [ ] Hello Worldプログラムのコンパイル・実行
  - [ ] コンパイルエラーの適切な表示
  - [ ] 標準出力の正常な表示

- [ ] ブラウザ動作確認
  - [ ] Chrome DevTools MCPを使った動作確認
  - [ ] モバイルデバイスでの表示確認
  - [ ] ダークモードの動作確認

## ドキュメント

- [ ] README.mdの更新
  - [ ] セットアップ手順
  - [ ] 使い方
  - [ ] 技術スタック
  - [ ] 開発手順

- [ ] 振り返りの記録
  - [ ] results/ディレクトリの作成
  - [ ] 作業完了後の振り返り記録（prompts.mdのフォーマットに従う）
