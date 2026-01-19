# 振り返り: サンプルコードセレクター実装

日時: 2026-01-20 02:31 JST

## 実装内容

エディタの右上にサンプルコードセレクター（セレクトボックス）を追加しました。

### 追加機能

1. **サンプルコード定義**
   - "Hello": シンプルな単一ファイルの例
   - "Multiple Files": 複数ファイルを使った例（main.mbt + lib.mbt）

2. **UI配置**
   - エディタの右上にセレクトボックスを配置
   - "Code Editor"ラベルとセレクトボックスを横並びに配置
   - デフォルトは"Hello"を選択

3. **動作**
   - セレクトボックスを変更すると、エディタの内容が即座に切り替わる
   - 各サンプルは独立して動作確認済み

### 実装箇所

**src/app.tsx の変更:**

1. サンプルコード定義（6-23行目）:
```typescript
const SAMPLE_CODES = {
  'Hello': `fn main {
  println("Hello, MoonBit!")
  let x = 42
  println("The answer is \\{x}")
}`,
  'Multiple Files': `fn main {
  hello()
  let result = add(10, 20)
  println("10 + 20 = \\{result}")
}
-- lib.mbt --
pub fn hello() -> Unit {
  println("Hello from lib.mbt!")
}

pub fn add(a : Int, b : Int) -> Int {
  a + b
}`
};
```

2. 状態管理（77行目）:
```typescript
const [selectedSample, setSelectedSample] = useState<keyof typeof SAMPLE_CODES>('Hello');
```

3. イベントハンドラ（122-126行目）:
```typescript
const handleSampleChange = (e: Event) => {
  const value = (e.target as HTMLSelectElement).value as keyof typeof SAMPLE_CODES;
  setSelectedSample(value);
  setCode(SAMPLE_CODES[value]);
};
```

4. UI実装（138-150行目）:
```typescript
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
  <label style={{ margin: 0 }}>Code Editor</label>
  <select 
    value={selectedSample} 
    onChange={handleSampleChange}
    style={{ width: 'auto', marginBottom: 0 }}
  >
    {Object.keys(SAMPLE_CODES).map(key => (
      <option key={key} value={key}>{key}</option>
    ))}
  </select>
</div>
```

## テスト結果

### 開発環境（npm run dev）
✅ "Hello"サンプル選択・実行成功
- 出力: "Hello, MoonBit!" / "The answer is 42"

✅ "Multiple Files"サンプル選択・実行成功
- 出力: "Hello from lib.mbt!" / "10 + 20 = 30"

✅ サンプル間の切り替えが正常動作

### 本番環境（npm run build + preview）
✅ "Hello"サンプル選択・実行成功
✅ "Multiple Files"サンプル選択・実行成功
✅ ビルドサイズ: 11.7MB (gzip: 3.75MB)

## ドキュメント更新

### README.md
- "サンプルコード"セクションを追加
- セレクトボックスの使い方を説明
- 2つのサンプルについて記載

### スクリーンショット
- `results/screenshot-sample-selector.png`: セレクトボックスの表示
- `results/screenshot-sample-multifile-run.png`: Multiple Filesサンプルの実行中
- `results/screenshot-sample-multifile-output.png`: Multiple Filesの出力結果
- `results/screenshot-production-selector.png`: 本番環境でのセレクトボックス

## 次のステップ（オプション）

- [ ] さらに多くのサンプルを追加（配列操作、構造体、match式など）
- [ ] サンプルにコメント・説明を追加
- [ ] カスタムサンプルの保存機能（localStorage）

## まとめ

**✅ サンプルコードセレクター実装完了！**

ユーザーは簡単に異なるコード例を試すことができるようになりました。単一ファイルと複数ファイルの両方の例を提供することで、MoonBit Onlineの使い方がより分かりやすくなりました。

初心者でも簡単にMoonBitを試せる環境が整いました！🎉
