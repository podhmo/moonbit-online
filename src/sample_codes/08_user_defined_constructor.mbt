struct Point {
  x : Double
  y : Double

  fn new(x~ : Double, y? : Double) -> Point
} derive(Show)

///|
fn Point::new(x~ : Double, y? : Double = 0.0) -> Point {
  { x, y }
}

///|
struct Rectangle {
  top_left : Point
  width : Double
  height : Double

  fn new(top_left~ : Point, width~ : Double, height? : Double) -> Rectangle
} derive(Show)

///|
fn Rectangle::new(
  top_left~ : Point,
  width~ : Double,
  height? : Double = width,
) -> Rectangle {
  { top_left, width, height }
}

///|
fn main {
  println("\n=== ユーザー定義コンストラクタ ===")
  let p1 = Point(x=3.0, y=4.0)
  let p2 = Point(x=5.0) // yはデフォルト0.0
  println("Point1: x=" + p1.x.to_string() + ", y=" + p1.y.to_string())
  println("Point2: x=" + p2.x.to_string() + ", y=" + p2.y.to_string())

  let rect = Rectangle(top_left=p1, width=10.0)
  println(
    "Rectangle: width=" +
    rect.width.to_string() +
    ", height=" +
    rect.height.to_string(),
  )
}
