import assert from "node:assert/strict";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const mode = process.argv[2];
if (!["missing", "http", "ws"].includes(mode)) throw new Error("missing, http, ws 중 하나를 지정하세요.");

const script = mode === "http"
  ? 'fetch("https://outside.invalid/resource").catch(() => {}).finally(() => { document.body.dataset.done = "1"; });'
  : mode === "ws"
    ? 'const ws = new WebSocket("wss://outside.invalid/socket"); ws.onclose = () => { document.body.dataset.done = "1"; };'
    : "";
const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<h1>Local page</h1><script>${script}</script>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

let browser;
try {
  const kit = await import(pathToFileURL(join(process.env.DEMO_DIR, "demo-kit.mjs")).href);
  const opened = await kit.openBrowser();
  browser = opened.browser;
  await opened.page.goto(`http://127.0.0.1:${server.address().port}/`);
  if (mode === "missing") {
    await assert.rejects(kit.seen(opened.page.getByText("Absent"), "없는 요소", 200), /장면 확인 실패/);
  } else {
    await opened.page.waitForFunction(() => document.body.dataset.done === "1");
    await assert.rejects(kit.say(opened.page, "1", "로컬 화면"), /로컬 외부 요청이 차단/);
  }
  await kit.finish(browser);
  browser = null;
  assert.equal(process.exitCode, 1);
  process.exitCode = 0;
  console.log(`${mode} 실패 감지 통과`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
