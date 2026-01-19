# 振り返り: パッケージimport対応（@hashmap）

日時: 2026-01-20 03:17 JST

## 実装内容

`@moonbitlang/core/hashmap`パッケージを使った"With Package Import"サンプルを実装しました。

### 実装した機能

1. **@hashmapパッケージの使用**
   - HashMap の作成、操作、表示
   - from_array()でマップを初期化
   - set(), remove(), get(), size()メソッドを使用

2. **エラー表示の強調**
   - 赤い背景（#2d1a1a）
   - 左ボーダー（4px solid #e74c3c）
   - エラーテキストの色（#ff6b6b）
   - コンパイルエラーや実行時エラーを視覚的に強調

3. **パターンマッチングとOption型**
   - `map.get()`の結果をパターンマッチング
   - `Some(v)`と`None`の処理

4. **パイプ演算子**
   - `map.remove("a") |> ignore`でvoid結果を処理

### 実装コード例

```moonbit
fn main {
  // Using @moonbitlang/core/hashmap package
  let map = @hashmap.from_array([("a", 1), ("b", 2), ("c", 3)])
  println("Initial map: \{map}")
  
  // Remove an entry
  map.remove("a") |> ignore
  println("After removing 'a': \{map}")
  
  // Add new entries
  map.set("d", 4)
  map.set("e", 5)
  println("After adding 'd' and 'e': \{map}")
  
  // Get a value
  match map.get("b") {
    Some(v) => println("Value of 'b': \{v}")
    None => println("Key 'b' not found")
  }
  
  println("Map size: \{map.size()}")
}
```

### 実装箇所

**src/app.tsx の変更:**

1. エラー状態管理（103行目）:
```typescript
const [isError, setIsError] = useState(false);
```

2. エラー表示スタイル（210-218行目）:
```typescript
<pre style={{ 
  background: isError ? '#2d1a1a' : '#1a1a1a',
  borderLeft: isError ? '4px solid #e74c3c' : 'none',
  padding: '1rem', 
  borderRadius: '0.25rem',
  minHeight: '150px',
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  color: isError ? '#ff6b6b' : 'inherit'
}}>
```

3. エラーフラグ設定（122-123, 133行目）:
```typescript
setIsError(false);  // handleRun開始時
setIsError(true);   // エラー発生時
```

## テスト結果

### 開発環境（npm run dev）
✅ "Hello"サンプル正常動作
✅ "Multiple Files"サンプル正常動作
✅ "With Package Import"（@hashmap）正常動作
- 出力: 
  ```
  Initial map: HashMap::of([("c", 3), ("b", 2), ("a", 1)])
  After removing 'a': HashMap::of([("c", 3), ("b", 2)])
  After adding 'd' and 'e': HashMap::of([("c", 3), ("d", 4), ("e", 5), ("b", 2)])
  Value of 'b': 2
  Map size: 4
  ```

### 本番環境（npm run build + preview）
✅ すべてのサンプルが正常動作
✅ ビルドサイズ: 11.7MB（gzip: 3.75MB）
✅ エラー表示の強調が正しく動作

## moonpad-monacoの制限と対応

### 判明した制限
1. **パッケージ名固定**: `"moonpad/lib"`のみ
2. **単一パッケージ構造**: 複数パッケージのimportは不可能
3. **設定ファイルのカスタマイズ不可**: moon.pkg.json/moon.mod.jsonは自動生成
4. **fn mainでのエラーハンドリング関数**: Result型を返す関数（@strconvなど）は使用不可

### 試行錯誤の経緯

#### 失敗例1: 自前パッケージのimport
```moonbit
-- main/main.mbt --
fn main {
  @lib.greet("MoonBit")  // ❌ Package "lib" not found
}
-- lib/top.mbt --
pub fn greet(name : String) -> Unit { ... }
```
→ moonpad-monacoは単一パッケージのみサポート

#### 失敗例2: @strconvパッケージ
```moonbit
let b = @strconv.parse_bool("true")  
// ❌ Function with error is not allowed in fn main
```
→ Result型を返す関数はfn mainで使用不可

#### 成功例: @hashmapパッケージ ✅
```moonbit
let map = @hashmap.from_array([("a", 1), ("b", 2)])
println(map)  // ✅ HashMap::of([("a", 1), ("b", 2)])
```
→ エラーを返さない関数なら使用可能

### 利用可能な標準ライブラリパッケージ

- ✅ @hashmap - HashMap操作
- ✅ println, 配列, Option型 - 組み込み機能
- ✅ パターンマッチング, パイプ演算子
- ❌ @strconv - Result型を返すため使用不可
- ❌ カスタムパッケージimport - 単一パッケージ制限

## ドキュメント更新

### TODO.md
- moon.pkg.json/moon.mod.jsonタスクを完了としてマーク
- moonpad-monaco APIの制限を詳細に記載
- 実装済み機能と制限事項を明記

### スクリーンショット
- `results/screenshot-hashmap-code.png`: @hashmapコード例
- `results/screenshot-hashmap-output.png`: 実行結果（開発環境）
- `results/screenshot-hashmap-production.png`: 本番環境での動作

## まとめ

**✅ パッケージimport対応完了！**

moonpad-monacoのAPI制限により完全な複数パッケージ対応は不可能でしたが、@moonbitlang/coreの標準ライブラリ（@hashmap等）を使用することで、実用的なパッケージimportの例を実装できました。

### 3つのサンプルコード

1. **Hello**: MoonBitの基礎（変数、println、文字列補間）
2. **Multiple Files**: 同一パッケージ内の複数ファイル
3. **With Package Import**: 標準ライブラリ（@hashmap）の使用

これにより、初心者から中級者まで、段階的にMoonBitを学べるプレイグラウンドが完成しました！🎉
