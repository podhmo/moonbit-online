extern "js" fn fetch_demo(on_done : (String) -> Unit) -> Unit =
  #| (on_done) => {
  #|   globalThis.__moonbit_run_wait_promise__ = fetch("data:text/plain,hello-from-fetch")
  #|     .then((response) => response.text())
  #|     .then((body) => on_done(body))
  #|     .catch((error) => on_done("fetch error: " + String(error)))
  #| }

fn main {
  fetch_demo(fn (body) {
    println("fetch body: \{body}")
  })
}
