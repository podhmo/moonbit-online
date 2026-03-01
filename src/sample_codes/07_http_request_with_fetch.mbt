extern "js" fn fetch_demo() -> Unit =
  #| () => {
  #|   globalThis.__moonbit_run_wait_promise__ = fetch("data:text/plain,hello-from-fetch")
  #|     .then((response) => response.text())
  #|     .then((body) => console.log("fetch body:", body))
  #|     .catch((error) => console.log("fetch error:", String(error)))
  #| }

fn main {
  fetch_demo()
}
