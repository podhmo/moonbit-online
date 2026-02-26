fn sum(data~ : Array[Int], start? : Int = 0, length? : Int) -> Int {
  let end = if length is Some(length) { start + length } else { data.length() }
  for i = start, sum = 0; i < end; i = i + 1, sum = sum + data[i] {
  } else {
    sum
  }
}

test "sum" {
  let array = [1, 2, 3, 4, 5]
  inspect(sum(data=array), content="15")
  inspect(sum(data=array, start=1), content="14")
  inspect(sum(data=array, length=3), content="6")
  let length = None
  // Use `?` for punning
  inspect(sum(data=array, length?), content="15")
}
