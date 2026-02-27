// 本来はmoon.pkgを利用してlibをimportするがそれには対応してない
// またパッケージパスは単層のパスのみ対応。ネストしたパスは不可。

fn main {
  println(@dep.add3(10))
}

-- dep/lib.mbt --
pub fn add3(x : Int) -> Int {
  plus(x, 3)
}

-- dep/math.mbt --
pub fn plus(a : Int, b : Int) -> Int {
  a + b
}
