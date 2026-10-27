import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

let deleteCalls = 0;
let itemExists = true;
const server = createServer((req, res) => {
  if (req.url === "/item" && req.method === "DELETE") {
    itemExists = false;
    res.writeHead(204);
    res.end();
    return;
  }
  if (req.url === "/delete") {
    deleteCalls += 1;
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end('{"error":"delete failed"}');
    return;
  }
  if (req.url === "/ok") {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html><html><body>
    <form id="login"><input name="username"><input type="password"><button>Sign in</button></form>
    <script>document.querySelector("#login").addEventListener("submit", (event) => {
      event.preventDefault();
      event.currentTarget.remove();
      document.body.innerHTML = "<h1>Signed in</h1>";
    });</script>
  </body></html>`);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
process.env.DEMO_URL = `http://127.0.0.1:${server.address().port}/`;
process.env.DEMO_USER = "demo-user";
process.env.DEMO_PASSWORD = "demo-password";

let browser;

try {
  const kit = await import(pathToFileURL(join(process.env.DEMO_DIR, "demo-kit.mjs")).href);
  const adapter = await import(pathToFileURL(join(process.env.DEMO_DIR, "adapters/generic.mjs")).href);
  const opened = await kit.openBrowser();
  browser = opened.browser;
  const { page } = opened;
  await page.goto(process.env.DEMO_URL);
  assert.equal(await adapter.login(page), true);
  assert.equal(page.url(), process.env.DEMO_URL);
  const heading = page.getByRole("heading", { name: "Signed in" });
  await kit.seen(heading, "로그인 뒤 화면");
  await kit.mark(heading);
  await kit.say(page, "1 · 로그인", "로그인됐습니다", ["화면에서 확인할 수 있습니다."]);
  assert.equal(await page.locator("#__demo_caption").isVisible(), true);
  assert.equal((await adapter.api(page, "GET", "/ok")).status, 204);
  await assert.rejects(adapter.api(page, "DELETE", "/delete"), /HTTP 500/);
  adapter.cleanup(() => adapter.api(page, "DELETE", "/item"));
  adapter.cleanup(() => adapter.api(page, "DELETE", "/delete"));
  await kit.finish(browser);
  browser = null;
  assert.equal(deleteCalls, 2);
  assert.equal(itemExists, false);
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
  console.log("로그인·정리 실패 검사 통과");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
