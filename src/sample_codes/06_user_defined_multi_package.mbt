fn main {
  println(@dep.add3(10))
}

-- dep/lib.mbt --
pub fn add3(x : Int) -> Int {
  nested_plus(x, 3)
}

-- dep/nested/math.mbt --
pub fn nested_plus(a : Int, b : Int) -> Int {
  a + b
}
