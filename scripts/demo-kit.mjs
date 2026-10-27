/* 웹 기능 데모 공용 도구 — 서비스와 무관한 부분만 담는다. 로그인·데이터 준비·정리는 서비스별 어댑터(adapters/*.mjs)가 맡는다.
 *
 * 환경 변수
 *   DRY=1            창 없이 빠르게 돌려 확인 지점(seen)만 센다. 본 재생 전에 반드시 한 번 돌린다
 *   PACE=0.2         대기 시간 배율(DRY 기본 0.2, 본 재생 1)
 *   SLOWMO=220       본 재생의 동작 간격(ms)
 *   DEMO_CHANNEL     브라우저 채널(기본 chrome — 설치된 Chrome). 빈 문자열이면 Playwright 내장 Chromium
 *   RECORD=1         본 재생의 장면을 WebM으로 저장한다(DRY에서는 녹화하지 않는다)
 *   DEMO_VIDEO_PATH  저장할 영상 경로(기본: 현재 폴더에 날짜가 붙은 파일)
 *   KEEP=1           끝날 때 정리(onCleanup)를 건너뛴다 */
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const pw = await import("@playwright/test").catch(() => import("playwright")).catch(() => import("playwright-core"));
const { chromium } = pw;

export const DRY = process.env.DRY === "1";
const PACE = Number(process.env.PACE ?? (DRY ? 0.2 : 1));
const RECORD = process.env.RECORD === "1";
const VIDEO_SIZE = { width: 1280, height: 720 };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms * PACE));
const checks = [];
const cleanups = [];
const recordings = new WeakMap();
const blockedOrigins = new Set();
let cleanupRequest = null;
let remoteBlockedResolve;
const remoteBlocked = new Promise((resolve) => { remoteBlockedResolve = resolve; });
let interruptResolve;
const interrupted = new Promise((resolve) => { interruptResolve = resolve; });
let onInterrupt;
let onTerminate;

function installInterruptHandlers() {
  if (onInterrupt) return;
  onInterrupt = () => { process.exitCode = 130; interruptResolve(); };
  onTerminate = () => { process.exitCode = 143; interruptResolve(); };
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);
}

function isLoopback(hostname) {
  return hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}

export function assertLocalUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} 주소가 올바르지 않습니다.`); }
  if (!["http:", "https:"].includes(url.protocol) || !isLoopback(url.hostname)) {
    throw new Error(`${name}에는 루프백 HTTP(S) 주소만 사용할 수 있습니다: ${url.origin}`);
  }
  return url.href;
}

function blockRemote(value) {
  const origin = new URL(value).origin;
  if (!blockedOrigins.has(origin)) console.error(`원격 요청 차단: ${origin}`);
  blockedOrigins.add(origin);
  remoteBlockedResolve();
}

function checkRemoteRequests() {
  if (process.exitCode === 130 || process.exitCode === 143) throw new Error("시연이 중단됐습니다.");
  if (blockedOrigins.size) throw new Error(`로컬 외부 요청이 차단됐습니다: ${[...blockedOrigins].join(", ")}`);
}

export const requestForApi = (page) => cleanupRequest ?? page.context().request;

/* ── 브라우저 ─────────────────────────────────────────── */

/** 본 재생은 창을 띄워 모니터에 맞춰 최대화하고 페이지가 창 크기를 따른다. */
export async function openBrowser({ swap, swapBase } = {}) {
  installInterruptHandlers();
  const channel = process.env.DEMO_CHANNEL ?? "chrome";
  const browser = await chromium.launch({
    ...(channel ? { channel } : {}),
    headless: DRY,
    slowMo: DRY ? 0 : Number(process.env.SLOWMO ?? 220),
    args: DRY ? [] : RECORD ? ["--window-size=1280,807"] : ["--start-maximized"],
    handleSIGINT: false,
    handleSIGTERM: false,
  });
  const context = await browser.newContext({
    viewport: RECORD ? VIDEO_SIZE : DRY ? { width: 1440, height: 900 } : null,
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (!/^https?:/i.test(url)) return route.continue();
    try { assertLocalUrl(url, "브라우저 요청"); }
    catch {
      blockRemote(url);
      return route.abort();
    }
    await route.continue();
  });
  if (!context.routeWebSocket) {
    await browser.close();
    throw new Error("현재 Playwright 버전은 WebSocket 차단을 지원하지 않습니다. 독립 실행기로 설치해 다시 실행하세요.");
  }
  await context.routeWebSocket(/^wss?:/, (ws) => {
    const url = new URL(ws.url());
    if (!isLoopback(url.hostname)) {
      blockRemote(ws.url());
      return ws.close({ code: 1008, reason: "Local demo only" });
    }
    ws.connectToServer();
  });
  const page = await context.newPage();
  if (!DRY) {
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    const bounds = RECORD ? { windowState: "normal", width: 1280, height: 807 } : { windowState: "maximized" };
    await cdp.send("Browser.setWindowBounds", { windowId, bounds }).catch(() => {});
  }
  await page.addInitScript(drawCaption);
  if (swap) await swapModules(page, swap, swapBase);
  return { browser, context, page };
}

export async function startRecording(page) {
  if (DRY || !RECORD) return;
  if (!page.screencast?.start) throw new Error("녹화에는 Playwright 1.59 이상이 필요합니다. 독립 실행기로 설치해 다시 실행하세요.");
  const name = `web-feature-demo-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
  const path = resolve(process.env.DEMO_VIDEO_PATH ?? name);
  await mkdir(dirname(path), { recursive: true });
  await page.screencast.start({ path, size: VIDEO_SIZE });
  recordings.set(page, path);
  console.log(`녹화 시작: ${path}`);
}

export async function stopRecording(page) {
  const path = recordings.get(page);
  if (!path) return;
  await page.screencast.stop();
  recordings.delete(page);
  console.log(`영상 저장: ${path}`);
}

/** 수정 전 화면 — Vite 개발 서버가 경로로 서빙하는 모듈을 사본으로 바꿔 끼운다(작업 트리 무변경).
 *  swap = { "/src/…/X.tsx": "/<서빙되는 사본 경로>/X.tsx" }, base = 개발 서버 주소.
 *  Vite 가 아닌 서버(webpack·Next)는 references/before-after.md 의 다른 방법을 쓴다. */
export async function swapModules(page, swap, base) {
  await page.route((u) => Object.hasOwn(swap, u.pathname), async (route) => {
    const url = new URL(route.request().url());
    const res = await route.fetch({ url: new URL(swap[url.pathname], base ?? url.origin).href });
    if (res.status() !== 200) throw new Error(`사본 ${swap[url.pathname]} ${res.status()}`);
    await route.fulfill({ response: res, headers: { ...res.headers(), "cache-control": "no-store" } });
  });
}

/** 서버 실패를 흉내 낸다. times 번 실패시키거나, on=true 인 동안 계속 실패시킨다.
 *  화면 조회는 재시도가 붙는 경우가 많아 한 번만 실패시키면 실패가 안 보인다 — 조회에는 on 을 쓴다. */
export async function inject(page, { method, url, status = 500, body, contentType = "application/json" }) {
  const ctl = { times: 0, on: false };
  await page.route(url, async (route) => {
    if (route.request().method() === method && (ctl.on || ctl.times > 0)) {
      if (!ctl.on) ctl.times -= 1;
      return route.fulfill({ status, contentType, body: body ?? JSON.stringify({ message: "Internal Server Error" }) });
    }
    return route.fallback();
  });
  return ctl;
}

/* ── 설명 상자 · 표시 · 확인 지점 ───────────────────────── */

function drawCaption() {
  const draw = () => {
    let d = null;
    try { d = JSON.parse(sessionStorage.getItem("demoCaption") ?? "null"); } catch {}
    let box = document.getElementById("__demo_caption");
    if (!d) { box?.remove(); return; }
    if (!box) {
      box = document.createElement("div");
      box.id = "__demo_caption";
      box.lang = "ko";
      box.style.cssText =
        "position:fixed;left:16px;bottom:16px;z-index:2147483647;max-width:560px;pointer-events:none;word-break:keep-all;" +
        "background:rgba(17,24,39,.94);color:#fff;border-left:6px solid #22c55e;border-radius:10px;padding:14px 16px;" +
        "font:15px/1.6 'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',-apple-system,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35)";
      document.documentElement.appendChild(box);
    }
    const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    box.innerHTML =
      `<div style="font-size:12px;color:#86efac;font-weight:600;margin-bottom:4px">${esc(d.step)}</div>` +
      `<div style="font-size:17px;font-weight:700;margin-bottom:6px">${esc(d.title)}</div>` +
      d.lines.map((l) => `<div style="margin-top:3px">${esc(l)}</div>`).join("");
  };
  window.__demoDraw = draw;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", draw);
  else draw();
}

const HANGUL = /[가-힣]/;

/** 왼쪽 아래 설명 상자를 바꾸고 hold(ms) 만큼 보여 준다. 설명은 한국어로 쓴다 — 한글이 없으면 경고를 남긴다.
 *  화면이 바뀌어도 세션 저장소에서 다시 그린다(같은 출처 안에서). */
export async function say(page, step, title, lines = [], hold = 0) {
  checkRemoteRequests();
  if (!HANGUL.test(`${step}${title}${lines.join("")}`)) console.warn(`경고: 설명 상자가 한국어가 아닙니다 — ${title}`);
  console.log(`\n[${step}] ${title}${lines.length ? "\n  " + lines.join("\n  ") : ""}`);
  await page.evaluate((d) => {
    sessionStorage.setItem("demoCaption", JSON.stringify(d));
    window.__demoDraw?.();
  }, { step, title, lines });
  if (hold) await sleep(hold);
  checkRemoteRequests();
}

/** 마지막 설명 상자 */
export const sayEnd = (page) =>
  say(page, "끝", "데모를 마쳤습니다", ["창은 열어 둡니다. 직접 눌러 보셔도 됩니다(창을 닫으면 끝납니다)."], 2000);

/** 확인 지점 — 보여 주려는 것이 실제로 화면에 떴는가. DRY 에서 MISS 가 하나라도 있으면 본 재생하지 않는다. */
export async function seen(locator, label, timeout = 8000) {
  checkRemoteRequests();
  const ok = await locator.first().waitFor({ timeout }).then(() => true, () => false);
  checks.push({ label, ok });
  console.log(`${ok ? "OK  " : "MISS"} ${label}`);
  checkRemoteRequests();
  if (!ok) throw new Error(`장면 확인 실패: ${label}`);
  return true;
}

/** 요소를 하이라이팅하고 화면 가운데로 스크롤한다 */
export async function mark(locator) {
  await locator.first().evaluate((el) => {
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (!el.hasAttribute("data-web-feature-demo-highlight")) {
      el.dataset.webFeatureDemoOutline = el.style.outline;
      el.dataset.webFeatureDemoOutlineOffset = el.style.outlineOffset;
      el.setAttribute("data-web-feature-demo-highlight", "");
    }
    el.style.outline = "3px solid #22c55e";
    el.style.outlineOffset = "3px";
  });
}

export async function unmark(page) {
  await page.evaluate(() => {
    document.querySelectorAll("[data-web-feature-demo-highlight]").forEach((el) => {
      el.style.outline = el.dataset.webFeatureDemoOutline;
      el.style.outlineOffset = el.dataset.webFeatureDemoOutlineOffset;
      delete el.dataset.webFeatureDemoOutline;
      delete el.dataset.webFeatureDemoOutlineOffset;
      el.removeAttribute("data-web-feature-demo-highlight");
    });
  });
}

/* ── 마무리 ─────────────────────────────────────────── */

/** 끝날 때 할 정리(데모 데이터 삭제 등)를 등록한다. 어댑터가 쓴다 */
export const onCleanup = (fn) => cleanups.push(fn);

/** DRY 면 확인 지점을 집계하고 정리한 뒤 끝낸다(MISS 가 있으면 종료 코드 1).
 *  본 재생이면 창을 열어 둔다 — 사용자가 닫거나 30분이 지나면 정리하고 끝낸다. */
export async function finish(browser) {
  const miss = checks.filter((c) => !c.ok);
  console.log(`\nCHECKS ${checks.length - miss.length}/${checks.length} OK${miss.length ? " MISS=" + JSON.stringify(miss.map((m) => m.label)) : ""}`);
  if (cleanups.length && browser.isConnected()) {
    try {
      cleanupRequest = await pw.request.newContext({ storageState: await browser.contexts()[0].storageState() });
    } catch (e) {
      console.error(`정리용 세션 준비 실패: ${String(e).slice(0, 200)}`);
      process.exitCode = 1;
    }
  }
  if (!DRY && !process.exitCode && !miss.length && !blockedOrigins.size && browser.isConnected()) {
    let timer;
    let onDisconnected;
    const closed = new Promise((resolve) => {
      onDisconnected = resolve;
      browser.once("disconnected", onDisconnected);
    });
    try {
      await Promise.race([closed, interrupted, remoteBlocked, new Promise((resolve) => { timer = setTimeout(resolve, 30 * 60 * 1000); })]);
    } finally {
      clearTimeout(timer);
      browser.off("disconnected", onDisconnected);
    }
  }
  if (miss.length || blockedOrigins.size) process.exitCode = 1;
  if (process.env.KEEP === "1") console.log("정리를 건너뛰었다(KEEP=1)");
  else for (const fn of cleanups) await fn().catch((e) => {
    console.error(`정리 실패: ${String(e).slice(0, 200)}`);
    process.exitCode = 1;
  });
  await cleanupRequest?.dispose().catch(() => {});
  await browser.close().catch(() => {});
  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onTerminate);
  onInterrupt = null;
  onTerminate = null;
}
