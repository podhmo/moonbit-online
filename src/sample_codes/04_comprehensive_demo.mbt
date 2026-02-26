// ============================================
// MoonBit Comprehensive Feature Demo
// Standard Library Only
// ============================================

// ----------------------------------------
// 1. Error Types (suberror)
// ----------------------------------------
suberror EvalError {
  DivByZero
  UnknownVariable(String)
}

// ----------------------------------------
// 2. Algebraic Data Types (Enum with payloads)
// ----------------------------------------
enum Expression {
  Number(Double)
  Variable(String)
  Add(Expression, Expression)
  Mul(Expression, Expression)
  Div(Expression, Expression)
  Let(String, Expression, Expression) // let x = e1 in e2
}

// ----------------------------------------
// 3. Structs with mut fields
// ----------------------------------------
struct Environment {
  bindings : Map[String, Double]
  mut eval_count : Int
}

struct Stats {
  sum : Double
  mean : Double
  samples : Array[Double]
}

// ----------------------------------------
// 4. Traits (Type Classes)
// ----------------------------------------
trait Show {
  to_string(Self) -> String
}

// ----------------------------------------
// 5. Methods and Trait Implementations
// ----------------------------------------

// Environment methods
fn Environment::new() -> Environment {
  { bindings: Map::new(), eval_count: 0 }
}

fn Environment::extend(self : Environment, name : String, value : Double) -> Environment {
  let new_bindings = self.bindings.copy()
  new_bindings.set(name, value)
  { bindings: new_bindings, eval_count: self.eval_count }
}

fn Environment::lookup(self : Environment, name : String) -> Double? {
  self.eval_count = self.eval_count + 1
  self.bindings.get(name)
}

// Show trait for Expression
impl Show for Expression with to_string(self) {
  match self {
    Number(n) => n.to_string()
    Variable(name) => name
    Add(e1, e2) => "(\{e1.to_string()} + \{e2.to_string()})"
    Mul(e1, e2) => "(\{e1.to_string()} * \{e2.to_string()})"
    Div(e1, e2) => "(\{e1.to_string()} / \{e2.to_string()})"
    Let(name, e1, e2) => "(let \{name} = \{e1.to_string()} in \{e2.to_string()})"
  }
}

// Show for Stats
impl Show for Stats with to_string(self) {
  "Stats(mean: \{self.mean}, sum: \{self.sum}, n: \{self.samples.length()})"
}

// ----------------------------------------
// 6. Pattern Matching & Error Handling
// ----------------------------------------
fn Expression::eval(self : Expression, env : Environment) -> Double raise EvalError {
  match self {
    Number(n) => n
    Variable(name) => {
      match env.lookup(name) {
        Some(v) => v
        None => raise EvalError::UnknownVariable(name)
      }
    }
    Add(e1, e2) => e1.eval(env) + e2.eval(env)
    Mul(e1, e2) => e1.eval(env) * e2.eval(env)
    Div(e1, e2) => {
      let divisor = e2.eval(env)
      if divisor == 0.0 {
        raise EvalError::DivByZero
      }
      e1.eval(env) / divisor
    }
    Let(name, e1, e2) => {
      let val = e1.eval(env)
      let new_env = env.extend(name, val)
      e2.eval(new_env)
    }
  }
}

// ----------------------------------------
// 7. Generic Functions & Named Parameters
// ----------------------------------------
fn[T] option_or_default(opt : T?, default~ : T) -> T {
  match opt {
    Some(v) => v
    None => default
  }
}

fn[T, U, E] result_map(result : Result[T, E], f : (T) -> U) -> Result[U, E] {
  match result {
    Ok(v) => Ok(f(v))
    Err(e) => Err(e)
  }
}

// Named parameters with defaults
fn create_stats(
  data : Array[Double],
  include_mean~ : Bool = true
) -> Stats {
  let n = data.length()
  let sum = if n == 0 {
    0.0
  } else {
    // Loop expression with accumulator
    loop (0, 0.0) {
      (i, acc) => {
        if i >= n {
          break acc // break returns value from loop
        }
        continue (i + 1, acc + data[i])
      }
    }
  }
  let mean = if include_mean && n > 0 {
    sum / n.to_double()
  } else {
    0.0
  }
  { sum, mean, samples: data }
}

// ----------------------------------------
// 8. Array Operations & Pattern Matching
// ----------------------------------------
fn analyze_list(lst : Array[Int]) -> String {
  match lst {
    [] => "Empty list"
    [x] => "Single element: \{x}"
    [first, second, .. rest] => {
      let len = lst.length()
      let rest_sum = loop (0, 0) {
        (i, acc) => {
          if i >= rest.length() {
            break acc
          }
          continue (i + 1, acc + rest[i])
        }
      }
      "First two: \{first}, \{second}; Total length: \{len}; Rest sum: \{rest_sum}"
    }
  }
}

fn array_sum(arr : Array[Int]) -> Int {
  // For loop as expression
  for i = 0, acc = 0; i < arr.length(); i = i + 1 {
    continue i + 1, acc + arr[i]
  } nobreak {
    acc
  }
}

// ----------------------------------------
// 9. String Processing with Views
// ----------------------------------------
fn is_palindrome(s : String) -> Bool {
  let view = s.view()
  fn check(v : StringView) -> Bool {
    match v {
      [] | [_] => true
      [first, .. rest, last] => {
        if first == last {
          check(rest)
        } else {
          false
        }
      }
    }
  }
  check(view)
}

// ----------------------------------------
// 10. Main Function - Demonstration
// ----------------------------------------
fn main {
  println("=== MoonBit Feature Showcase ===\n")

  // -- Variable bindings --
  let immutable_val = 42
  let mut mutable_val = 0
  mutable_val = immutable_val / 2
  println("Immutable: \{immutable_val}, Mutable: \{mutable_val}")

  // -- Expression evaluation with error handling --
  let env = Environment::new()
  let expr = Let("x", Number(10.0),
    Add(
      Variable("x"),
      Mul(Number(2.0), Div(Number(6.0), Number(2.0)))
    )
  )
  println("\nExpression: \{expr.to_string()}")
  try {
    let result = expr.eval(env)
    println("Evaluated to: \{result}")
    println("Total variable lookups: \{env.eval_count}")
  } catch {
    EvalError::DivByZero => println("Error: Division by zero!")
    EvalError::UnknownVariable(name) => println("Error: Unknown variable '\{name}'")
  }

  // -- Loop expressions --
  println("\n-- Loop Expressions --")
  let factorial_5 = loop (5, 1) {
    (n, acc) => {
      if n <= 1 {
        break acc
      }
      continue (n - 1, acc * n)
    }
  }
  println("5! = \{factorial_5}")

  // -- For loop as expression --
  let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  let sum_even = for i = 0, sum = 0; i < numbers.length(); i = i + 1 {
    if numbers[i] % 2 == 0 {
      continue i + 1, sum + numbers[i]
    } else {
      continue i + 1, sum
    }
  } nobreak {
    sum
  }
  println("Sum of even numbers: \{sum_even}")

  // -- While loop with break value --
  let mut count = 0
  let found = while count < 100 {
    count = count + 7
    if count > 50 {
      break "Found at \{count}"
    }
  } nobreak {
    "Not found"
  }
  println("While result: \{found}")

  // -- Pattern matching on arrays --
  println("\n-- Array Patterns --")
  let test_list = [1, 2, 3, 4, 5]
  println(analyze_list(test_list))

  // -- Option and Result types --
  println("\n-- Optional Values --")
  let maybe_value : Int? = Some(42)
  let defaulted = option_or_default(maybe_value, default=0)
  println("Option value: \{defaulted}")

  let division_result : Result[Double, EvalError] = try? {
    Expression::Div(Number(10.0), Number(0.0)).eval(Environment::new())
  }
  match division_result {
    Ok(v) => println("Division succeeded: \{v}")
    Err(_) => println("Division failed as expected")
  }

  // -- Statistics with named parameters --
  println("\n-- Statistics --")
  let data = [2.5, 3.5, 4.5, 5.5, 6.5]
  let stats = create_stats(data, include_mean=true)
  println(stats.to_string())

  // -- String view pattern matching --
  println("\n-- String Processing --")
  let words = ["radar", "moonbit", "level", "hello", "世界界世"]
  for word in words {
    if is_palindrome(word) {
      println("'\{word}' is a palindrome")
    }
  }

  // -- Map operations --
  println("\n-- Map Operations --")
  let map : Map[String, Int] = Map::new()
  map.set("one", 1)
  map.set("two", 2)
  map.set("three", 3)
  for key, value in map {
    println("\{key} => \{value}")
  }

  println("\n=== End of Demo ===")
}
