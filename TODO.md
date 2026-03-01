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

## 追加機能

- [x] go-playgroundのように複数ファイルを扱うことを可能にする。
  - [x] `-- filename --`区切りで複数ファイルをサポート
  - [x] parseMultipleFiles()関数の実装
  - [x] compileMultiple()メソッドの実装
  - [x] デフォルトコードを複数ファイルの例に変更
  - [x] 動作確認（2ファイル、3ファイル構成）
  
  **実装完了**: go-playground方式の複数ファイル対応が成功
  - 1つのテキストエリアで複数ファイルを扱える
  - `-- filename --`で区切ることでファイルを分割
  - エラーメッセージにファイル名とパス表示

- [x] サンプルコードセレクター
  - [x] エディタ右上にセレクトボックスを追加
  - [x] "Hello"サンプル（単一ファイル）
  - [x] "Multiple Files"サンプル（複数ファイル）
  - [x] サンプル切り替え機能の実装
  - [x] 動作確認（開発・本番環境）
  
  **実装完了**: 初心者でも簡単にサンプルを試せる
  - エディタ右上のセレクトボックスでサンプル選択
  - 単一ファイルと複数ファイルの例を提供
  - コードが即座に切り替わる

- [x] moon.pkg.json, moon.mod.jsonに対応する
  **✅ 実装完了（制限付き）**:
  
  ### moonpad-monacoの制限
  - パッケージ名が"moonpad/lib"に固定
  - 単一パッケージ構造のみサポート
  - 複数パッケージのimport構造は不可能
  - moon.pkg.json/moon.mod.jsonのカスタマイズ不可
  
  ### 実装した内容
  - ✅ @moonbitlang/core/hashmapパッケージの使用例
  - ✅ "With Package Import"サンプルコード
  - ✅ HashMap操作（from_array, set, remove, get, size）
  - ✅ パターンマッチング（Option型）
  - ✅ パイプ演算子（|>）の使用
  - ✅ エラー表示の強調（赤い背景+左ボーダー）
  
  ### 利用可能な標準ライブラリ
  - ✅ @hashmap - HashMap操作
  - ✅ println, 配列, Option型 - 組み込み機能
  - ❌ @strconv - Result型を返すため使用不可
  - ❌ カスタムパッケージimport - 単一パッケージ制限
  
  **代替案として十分な実装が完了**:
  - 3つのサンプルコード（Hello, Multiple Files, With Package Import）
  - 初心者から中級者まで段階的に学べる構成
  - 標準ライブラリの実用的な使用例を提供

- ✅formatterの追加

### go-playground

以下のような形で複数ファイルを使うことができる。

```
package main

import (
	"play.ground/foo"
)

func main() {
	foo.Bar()
}
-- go.mod --
module play.ground
-- foo/foo.go --
package foo

import "fmt"

func Bar() {
	fmt.Println("This function lives in an another file!")
}
```
