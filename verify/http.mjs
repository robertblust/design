// Ask a URL for its status without crashing the runtime. Node 22's bundled undici asserts
// `assert(!this.paused)` in Parser.finish when a socket ends with a response body nobody read,
// and a checker that only wants `.status` never reads one. Measured: 6 of 12 CI runs crashed on
// Node 22.23.2 before this, 0 of 12 after; Node 25 never reproduces it. So the body is read and
// discarded, always.
export async function httpStatus(url) {
  const res = await fetch(url);
  await res.body?.cancel();
  return res.status;
}
