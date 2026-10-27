import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { join } from "node:path";

let authenticatedVisits = 0;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  if (req.url === "/public") return res.end("<h1>Public page</h1>");
  if (req.url === "/app" && req.headers.cookie?.includes("demoAuth=1")) {
    authenticatedVisits += 1;
    return res.end("<h1>Account page</h1>");
  }
  if (req.url === "/app") {
    res.writeHead(302, { Location: "/login" });
    return res.end();
  }
  res.end(`<form id="login"><input type="email"><input type="password"><button>Sign in</button></form>
    <script>document.querySelector("#login").addEventListener("submit", (event) => {
      event.preventDefault();
      document.cookie = "demoAuth=1; Path=/";
      document.body.innerHTML = "<h1>Signed in</h1>";
    });</script>`);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

try {
  for (const mode of ["none", "before", "show"]) {
    const before = authenticatedVisits;
    const child = spawn(process.execPath, [join(process.env.DEMO_DIR, "template.mjs")], {
      env: {
        ...process.env,
        DRY: "1",
        PACE: "0",
        DEMO_URL: mode === "none" ? `${origin}/public` : `${origin}/app`,
        DEMO_LOGIN_URL: `${origin}/login`,
        DEMO_LOGIN_MODE: mode,
        DEMO_USER: mode === "none" ? "" : "demo@example.test",
        DEMO_PASSWORD: mode === "none" ? "" : "example-password",
      },
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const code = await new Promise((resolve) => child.on("exit", resolve));
    assert.equal(code, 0, output);
    assert.match(output, /CHECKS 1\/1 OK/);
    if (mode !== "none") assert.equal(authenticatedVisits, before + 1);
    if (mode === "show") assert.match(output, /\[0 · 로그인\]/);
    console.log(`${mode} 로그인 모드 통과`);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
