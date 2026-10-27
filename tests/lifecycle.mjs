import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const file = fileURLToPath(import.meta.url);
const mode = process.argv[2];

if (mode === "child") {
  const kit = await import(pathToFileURL(join(process.env.DEMO_DIR, "demo-kit.mjs")).href);
  const { browser, page } = await kit.openBrowser();
  kit.onCleanup(() => import("node:fs/promises").then(({ writeFile }) => writeFile(process.env.CLEANUP_MARKER, "done")));
  await page.goto("about:blank");
  if (process.env.SIMULATE_TIMEOUT === "1") {
    const realSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (fn, ms, ...args) => realSetTimeout(fn, ms === 30 * 60 * 1000 ? 300 : ms, ...args);
  }
  if (process.env.CLOSE_WINDOW === "1") setTimeout(() => browser.close(), 300);
  await kit.finish(browser);
} else {
  const dir = await mkdtemp(join(tmpdir(), "web-feature-demo-lifecycle-"));
  try {
    for (const signal of ["SIGINT", "SIGTERM", "close", "timeout", "keep"]) {
      const marker = join(dir, signal);
      const child = spawn(process.execPath, [file, "child"], {
        env: {
          ...process.env,
          DRY: "0",
          PACE: "0",
          SLOWMO: "0",
          CLEANUP_MARKER: marker,
          CLOSE_WINDOW: signal === "close" || signal === "keep" ? "1" : "0",
          SIMULATE_TIMEOUT: signal === "timeout" ? "1" : "0",
          KEEP: signal === "keep" ? "1" : "0",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let output = "";
      let sent = false;
      child.stdout.on("data", (chunk) => {
        output += chunk;
        if (["SIGINT", "SIGTERM"].includes(signal) && !sent && output.includes("CHECKS 0/0 OK")) {
          sent = true;
          child.kill(signal);
        }
      });
      child.stderr.on("data", (chunk) => { output += chunk; });
      const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
      const code = await new Promise((resolve) => child.on("exit", resolve));
      clearTimeout(timer);
      assert.equal(code, signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 0, output);
      if (signal === "keep") await assert.rejects(stat(marker), { code: "ENOENT" });
      else assert.equal(await readFile(marker, "utf8"), "done");
      console.log(`${signal} 종료 후 정리 통과`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
