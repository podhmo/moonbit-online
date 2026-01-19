# 🌙 MoonBit Online

MoonBitのWASMコンパイラを利用したブラウザ上で動作するオンラインプレイグラウンド。

![Screenshot](results/screenshot-phase3.png)

## 特徴

- 🌐 **完全ブラウザベース**: サーバーサイド不要、全ての処理がブラウザ内で完結
- ⚡ **高速コンパイル**: WASM版のMoonBitコンパイラを使用
- 🔗 **URL共有**: コードをURLエンコードして簡単に共有
- 🎨 **ダークモード**: 目に優しいダークテーマ
- 📱 **レスポンシブ**: モバイル・デスクトップ対応

## デモ

[Live Demo](https://podhmo.github.io/moonbit-online/) （デプロイ後）

## 技術スタック

- **Frontend**: [Preact](https://preactjs.com/) + TypeScript
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Pico.css v2](https://picocss.com/)
- **Compiler**: [@moonbit/moonc-worker](https://www.npmjs.com/package/@moonbit/moonc-worker)
- **Worker Communication**: [Comlink](https://github.com/GoogleChromeLabs/comlink)

## セットアップ

### 前提条件

- Node.js 18+
- npm または yarn

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/podhmo/moonbit-online.git
cd moonbit-online

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

ブラウザで `http://localhost:5173/` を開きます。

### ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに生成されます。

## 使い方

1. **コードを書く**: エディタにMoonBitコードを入力
2. **実行**: 「Run」ボタンをクリックしてコンパイル・実行
3. **共有**: 「Share」ボタンでコードをURLエンコードしてクリップボードにコピー

### サンプルコード

```moonbit
fn main {
  let x = 42
  let y = x * 2
}
```

## 制限事項

現在のバージョンには以下の制限があります：

- ⚠️ **標準ライブラリ未対応**: `println`、`print`、`debug`等の標準関数は使用できません
- 📄 **単一ファイルのみ**: 複数ファイルプロジェクトには対応していません
- 🔤 **基本的なエディタ**: シンタックスハイライト、コード補完はありません
- 📦 **パッケージ管理**: 外部ライブラリのインポートはできません

## 開発

### プロジェクト構造

```
moonbit-online/
├── src/
│   ├── app.tsx          # メインアプリケーションコンポーネント
│   ├── compiler.ts      # MoonBitコンパイラのラッパー
│   └── main.tsx         # エントリーポイント
├── public/              # 静的ファイル
├── results/             # 振り返り・スクリーンショット
├── index.html           # HTMLテンプレート
├── vite.config.ts       # Vite設定
├── tsconfig.json        # TypeScript設定
├── TODO.md              # タスクリスト
└── README.md            # このファイル
```

### コンパイルフロー

1. ユーザーがMoonBitコードを入力
2. `@moonbit/moonc-worker`（Web Worker）でコンパイル
3. `buildPackage` APIでコアファイルを生成
4. `linkCore` APIでWASMバイナリを生成
5. `WebAssembly.instantiate`でWASMを実行
6. 結果を画面に表示

### URL共有の仕組み

コードは以下の手順でエンコード/デコードされます：

```typescript
// エンコード
const encoded = btoa(encodeURIComponent(code));
const url = `${origin}${pathname}#${encoded}`;

// デコード
const code = decodeURIComponent(atob(hash));
```

## トラブルシューティング

### コンパイルエラーが出る

- MoonBitの構文が正しいか確認してください
- main関数は `fn main { ... }` の形式で記述する必要があります
- 標準ライブラリの関数（`println`等）は現在使用できません

### URLからコードが復元されない

- URLハッシュが壊れていないか確認してください
- ブラウザのキャッシュをクリアしてみてください

## ロードマップ

- [ ] 標準ライブラリの統合
- [ ] シンタックスハイライト
- [ ] エラーメッセージの詳細表示
- [ ] サンプルコード集
- [ ] 複数ファイル対応

## 貢献

プルリクエスト、Issue報告を歓迎します！

## ライセンス

ISC

## 参考

- [MoonBit公式サイト](https://www.moonbitlang.com/)
- [MoonBit GitHub](https://github.com/moonbitlang)
- [moonpad-monaco](https://github.com/moonbitlang/moonpad-monaco) - 参考にした実装

---

詳しい仕様は [spec.md](./spec.md) を参照してください。
作業状況は [TODO.md](./TODO.md) を参照してください。
