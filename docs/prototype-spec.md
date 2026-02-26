これまでの対話と決定事項に基づき、**MoonBit-Mobile（仮）** のプロジェクト仕様詳細を構造化してダンプします。
この内容は、設計書および実装の指示書として機能する粒度でまとめています。

---

# プロジェクト詳細定義書: MoonBit-Mobile (MVP)

## 1. プロジェクト概要
*   **目的**: ブラウザ上で完結する MoonBit 言語の「コーディング → コンパイル → 実行」環境の構築。
*   **コンセプト**: PyMobile の UI/UX をベースにした、軽量・高速な学習/実験用ツール。
*   **ターゲット**: モバイル端末およびデスクトップブラウザ。
*   **主要な制約**: サーバーサイドでのコンパイルは行わず、公式配布の `moonc.wasm` をブラウザ内で動作させる。

## 2. 技術スタック
*   **Framework**: **PReact** (TypeScript)
    *   *理由: Reactより小さいので
*   **Styling**: **Pico.css v2**
    *   *設定: デフォルトでダークモード適用。*
*   **Compiler Core**: **MoonBit Toolchain (WASM)**
    *   *Artifacts*: `moonc.wasm` (コンパイラ本体), `lib/core` (標準ライブラリ)。
    *   *Source*: 公式リリースの `moonbit-wasm.tar.gz` から抽出。
*   **System Interface**:
    *   **Web Workers**: コンパイル処理のオフロード用。
    *   **WASI Shim / Polyfills**: `browser_wasi_shim` または `memfs` 等を使用し、コンパイラが要求するファイルシステムと環境変数（Node.js互換環境）をブラウザ上で再現する。
*   **State Management**: URL Hash (Base64 encoded source code)。

## 3. アーキテクチャ詳細

システムは **UI層**、**コンパイラ層**、**ランタイム層** の3層で構成される。

### A. UI層 (Main Thread)
*   **構成**:
    *   **Header**: タイトル、GitHubリンク等。
    *   **Editor Area**: `textarea` (シンタックスハイライトなし、または軽量なもの)。`main` 関数の入力用。
    *   **Action Bar**: 「Run」ボタン (Sticky配置)、共有ボタン。
    *   **Output Area**: コンパイルエラーログ、実行結果（標準出力）を表示。
*   **責務**: ユーザー入力の受付、Workerへのメッセージ送信、結果の描画。

### B. コンパイラ層 (Web Worker)
*   **中核コンポーネント**: `moonc.wasm`
*   **Virtual File System (VFS)**: メモリ上に以下の構造を偽装する。
    ```text
    /
    ├── moon.pkg.json  (固定の内容: {"package": {"name": "main"}})
    ├── main.mbt       (UIから受け取ったソースコード)
    └── lib/           (標準ライブラリ: 必要に応じて遅延ロードまたはバンドル)
    ```
*   **動作フロー**:
    1.  UIからソースコードを受信。
    2.  VFS に `main.mbt` を書き込む。
    3.  `moonc.wasm` を実行（引数: `build` 等）。
    4.  VFS 上に生成された `.wasm` ファイルをバイナリとして読み出す。
    5.  生成されたバイナリ（またはコンパイルエラーログ）をメインスレッドへ返却。

### C. ランタイム層 (Main Thread or Worker)
*   **中核コンポーネント**: WebAssembly Runtime (Browser Native)
*   **動作フロー**:
    1.  コンパイラ層から受け取った `.wasm` バイナリを `WebAssembly.instantiate` する。
    2.  **Imports**:
        *   `spectest.print_char` などをフックし、標準出力をキャプチャしてUIの Output Area に流す。
        *   MoonBitの標準ライブラリが必要とする数値演算等の外部関数を提供する。

## 4. 機能要件 (MVP)

### 必須機能 (Must-have)
1.  **エディタ機能**:
    *   プレーンテキスト入力。
    *   `main.mbt` 相当の単一ファイル編集。
2.  **コンパイル & 実行**:
    *   ボタン押下でビルド〜実行までをワンストップで行う。
    *   コンパイルエラー時: エラーメッセージを表示する。
    *   成功時: プログラムの実行結果を表示する。
3.  **URL共有**:
    *   ソースコードをBase64圧縮し、URLハッシュに埋め込んで共有可能にする。
    *   ページロード時にハッシュがあればコードを復元する。

### 除外機能 (Out of Scope for MVP)
*   **REPL**: 行ごとの対話実行は行わない。
*   **複数ファイル編集**: ユーザーは1つのテキストエリアのみ操作（裏ではVFSで管理）。
*   **高度なエディタ機能**: 補完、ジャンプ、LSP連携は行わない。
*   **パッケージ管理**: `moon.pkg.json` は固定。外部ライブラリの追加インストールは不可。

## 5. 実装ロードマップ

### Phase 1: コンパイラ起動検証 (技術的PoC)
*   **タスク**:
    *   `moonc.wasm` をブラウザでフェッチする。
    *   `browser_wasi_shim` 等を用いて、Node.js依存（fs, process）を回避して初期化する。
    *   ハードコードされた "Hello World" のコンパイルを成功させ、WASMバイナリを得る。
*   **ゴール**: コンソールにコンパイル成功ログが出る。

### Phase 2: ランタイム接続
*   **タスク**:
    *   Phase 1 で生成された WASM を実行するローダーを作成。
    *   標準出力をJSの文字列として取得する。
*   **ゴール**: "Hello World" がJSの変数に入る。

### Phase 3: UI構築 & 統合
*   **タスク**:
    *   PReact + Pico.css で画面を作成。
    *   Web Worker を実装し、Phase 1/2 のロジックを移動。
    *   UIとWorkerのメッセージング（コード送信 ⇔ 結果受信）を実装。
*   **ゴール**: 画面上のボタンでコードが動く。

## 6. 懸念点・リスク
*   **WASMサイズ**: `moonc.wasm` や標準ライブラリのサイズが大きく、初期ロードに時間がかかる可能性がある（プログレスバー等のUI考慮が必要）。
*   **Polyfillの完全性**: `moonc` が特殊なシステムコールを使用している場合、汎用的な WASI Shim では動かない可能性がある（その場合、エラーログを見ながら個別実装が必要）。


---

## 7. 実装完了報告（2026-01-20）

### 実装結果

当初の仕様から**大幅な方針転換**を行い、**MVP完成**しました。

### 方針変更の経緯

#### 当初の計画
- `moonc.wasm`を直接使用
- WASI Shim/Polyfillsによるファイルシステムのエミュレーション
- WASM出力による実行

#### 実際の実装
- **@moonbit/moonpad-monaco**を使用（公式のラッパーライブラリ）
- **JS出力方式**に変更（WASM出力ではなく）
- Workerファイル（moonc-worker.js, onig.wasm）をpublic/に配置

### 主要な技術的発見

1. **moonbit-tourの参考実装**
   - vendor/moonbit-docs/moonbit-tourのコードが解決の鍵
   - moonbit-tourと同じ実装方式を採用することで成功

2. **JS出力方式の利点**
   - 標準ライブラリが自動的にバンドルされる
   - .miファイルの手動管理が不要
   - println等の標準関数が即座に使用可能

3. **パッケージバージョンの重要性**
   - @moonbit/moonpad-monaco@0.1.202510171
   - monaco-editor-core@0.52.0
   - バージョンを合わせることが動作の鍵

### 実装された機能

✅ **Phase 1完了**: コンパイラ起動検証
- Vite + Preact + TypeScript環境構築
- @moonbit/moonpad-monacoの統合
- 基本的なコンパイル動作確認

✅ **Phase 2完了**: ランタイム接続（方式変更）
- JS出力による実行（当初のWASM実行から変更）
- moon.run()によるReadableStreamからの出力取得
- 標準ライブラリの完全サポート

✅ **Phase 3完了**: UI構築 & 統合
- Preact + Pico.cssによる直感的なUI
- コードエディタ（textarea）
- 実行ボタンとエラー表示
- URL共有機能（Base64エンコード）
- ダークモード対応
- レスポンシブデザイン

### 当初の懸念点の解決状況

#### WASMサイズの懸念
→ **解決**: JS出力方式により、実行時のWASMサイズは問題にならない
→ Workerファイル（合計約15MB）は初回ロード時のみ

#### Polyfillの完全性の懸念
→ **回避**: @moonbit/moonpad-monacoを使用することで、低レベルのPolyfill実装が不要に

### 制限事項

実装されなかった機能：
- 複数ファイルプロジェクトのサポート
- Monaco Editorの完全統合（シンタックスハイライト）
- パッケージ管理

これらは将来の拡張として残されています。

### ビルドプロセスの自動化

```json
"scripts": {
  "dev": "vite",
  "build": "vite build && npm run copy-workers",
  "copy-workers": "cp public/*.js public/*.wasm dist/",
  "preview": "vite preview"
}
```

ビルド時にWorkerファイルが自動的にdist/にコピーされます。

### 成果物

- 動作するWebアプリケーション
- 完全なドキュメント（README.md, info.md, TODO.md）
- 振り返りドキュメント（results/ディレクトリ）
- スクリーンショット

### 結論

当初の低レベル実装（WASI Shim + moonc.wasm直接利用）から、
公式ライブラリ（@moonbit/moonpad-monaco）を活用する高レベル実装に方針転換したことで、
**開発期間を大幅に短縮**し、**保守性の高い実装**を実現できました。

moonbit-tourの実装を参考にしたことが成功の鍵でした。
