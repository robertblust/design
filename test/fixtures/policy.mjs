// Every page a test's browser opens, watched for what its content policy refused. Chromium writes a
// refusal to the console as an error naming the Content Security Policy, from the page and from
// any frame in it, so one listener per page hears all of them; the list stays empty while the
// policy and the scripts under it agree.
export function watchPolicy(browser) {
  const refused = [];
  // Playwright's own newPage may open its context through newContext, which would watch a page
  // twice and hear each refusal twice.
  const watched = new WeakSet();
  const watch = (page) => {
    if (watched.has(page)) return;
    watched.add(page);
    page.on("console", (m) => {
      if (m.type() === "error" && /Content Security Policy/.test(m.text())) refused.push(m.text());
    });
  };
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...args) => {
    const context = await newContext(...args);
    context.on("page", watch);
    return context;
  };
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (...args) => {
    const page = await newPage(...args);
    watch(page);
    return page;
  };
  return refused;
}
