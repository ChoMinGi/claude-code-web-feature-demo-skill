/* 일반적인 로그인 폼과 API 호출을 위한 어댑터.
 *   DEMO_URL         데모할 화면 주소(필수)
 *   DEMO_LOGIN_URL   로그인 화면 주소(없으면 DEMO_URL)
 *   DEMO_USER        로그인 아이디·이메일 } 둘 다 있으면 login() 이 로그인 폼을 채운다
 *   DEMO_PASSWORD    비밀번호             }
 *   DEMO_API         API 주소(없으면 DEMO_URL 의 출처)
 *   DEMO_TOKEN       API 에 붙일 Bearer 토큰(쿠키 세션 서비스는 필요 없다 — 로그인한 브라우저 쿠키를 그대로 쓴다)
 * 다른 로그인 방식이나 별도 데이터 생성 절차가 필요하면 서비스별 어댑터를 만든다(references/adapters.md). */
import { assertLocalUrl, onCleanup, requestForApi } from "../demo-kit.mjs";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`환경 변수 ${name} 가 필요합니다. references/adapters.md 를 보세요.`);
    process.exit(2);
  }
  return v;
}

export const URL_ = assertLocalUrl(need("DEMO_URL"), "DEMO_URL");
const LOGIN_URL = assertLocalUrl(process.env.DEMO_LOGIN_URL ?? URL_, "DEMO_LOGIN_URL");
const API = assertLocalUrl(process.env.DEMO_API ?? new URL(URL_).origin, "DEMO_API").replace(/\/$/, "");

/** 로그인 폼을 채운다. DEMO_USER·DEMO_PASSWORD 가 없으면 아무것도 하지 않는다(로그인 없는 화면). */
export async function login(page) {
  const user = process.env.DEMO_USER;
  const password = process.env.DEMO_PASSWORD;
  if (!user || !password) return false;
  const loginUrl = LOGIN_URL;
  if (page.url() !== loginUrl) await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  const pw = page.locator('input[type="password"]').first();
  await pw.waitFor({ timeout: 20000 });
  const id = page
    .locator('input[type="email"], input[autocomplete="username"], input[name*="user" i], input[name*="email" i], input[name*="login" i], input[type="text"]')
    .first();
  await id.fill(user);
  await pw.fill(password);
  await pw.press("Enter");
  const completed = await Promise.any([
    page.waitForURL((u) => u.href !== loginUrl && !/log-?in|sign-?in|auth/i.test(u.pathname), { timeout: 20000 }),
    pw.waitFor({ state: "detached", timeout: 20000 }),
  ]).then(() => true, () => false);
  if (!completed) throw new Error("로그인 완료를 확인하지 못했습니다 — 계정이나 로그인 폼 모양을 확인하세요");
  return true;
}

/** API 호출. 로그인한 브라우저의 쿠키를 함께 보낸다. DEMO_TOKEN 이 있으면 Bearer 로 붙인다. */
export async function api(page, method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (process.env.DEMO_TOKEN) headers.Authorization = `Bearer ${process.env.DEMO_TOKEN}`;
  const url = assertLocalUrl(`${API}${path}`, "API 요청");
  const res = await requestForApi(page).fetch(url, {
    method,
    headers,
    data: body === undefined ? undefined : JSON.stringify(body),
    maxRedirects: 0,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok()) throw new Error(`API ${method} 요청 실패: HTTP ${res.status()}`);
  return { status: res.status(), body: json };
}

/** 데모가 만든 것을 끝에 지운다 — 예: cleanup(() => api(page, "DELETE", `/items/${id}`)) */
export const cleanup = (fn) => onCleanup(fn);
