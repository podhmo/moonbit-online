fn main {
  hello()
  let result = add(10, 20)
  println("10 + 20 = \{result}")
}
-- lib.mbt --
pub fn hello() -> Unit {
  println("Hello from lib.mbt!")
}

pub fn add(a : Int, b : Int) -> Int {
  a + b
}
