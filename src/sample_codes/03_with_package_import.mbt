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
  
  println("Map size: \{map.length()}")
}
