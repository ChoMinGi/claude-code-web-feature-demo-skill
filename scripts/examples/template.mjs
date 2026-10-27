/* 장면 스크립트 출발점. 서비스 화면에 맞게 복사해 고친다.
 * 실행: DEMO_URL=<데모할 화면 주소> [DEMO_LOGIN_MODE=none|before|show] [DRY=1] [RECORD=1] node <설치 폴더>/template.mjs
 *
 * 장면 하나 = 화면 조작 → seen(보여 줄 것) → mark(하이라이트) → say(설명, 보여 줄 시간).
 * 로그인은 범용 어댑터가 흔한 이메일·비밀번호 폼을 채운다. 폼이 특이하거나 데이터를 만들어야 하면 references/adapters.md. */
import { openBrowser, startRecording, stopRecording, say, sayEnd, seen, mark, finish } from "./demo-kit.mjs";
import { login, URL_ } from "./adapters/generic.mjs";

const hasUser = Boolean(process.env.DEMO_USER);
const hasPassword = Boolean(process.env.DEMO_PASSWORD);
const loginMode = process.env.DEMO_LOGIN_MODE ?? (hasUser || hasPassword ? "before" : "none");
if (!["none", "before", "show"].includes(loginMode)) throw new Error("DEMO_LOGIN_MODE는 none, before, show 중 하나여야 합니다.");
if (loginMode !== "none" && (!hasUser || !hasPassword)) throw new Error("로그인 시연에는 DEMO_USER와 DEMO_PASSWORD가 모두 필요합니다.");

const { browser, page } = await openBrowser();

try {
  if (loginMode === "before") await login(page);
  if (loginMode === "show") {
    await page.goto(process.env.DEMO_LOGIN_URL ?? URL_, { waitUntil: "domcontentloaded" });
    await startRecording(page);
    await say(page, "0 · 로그인", "로그인 화면", ["계정을 입력해 시연을 시작합니다."], 1800);
    await login(page);
  }
  await page.goto(URL_, { waitUntil: "domcontentloaded" });
  if (loginMode !== "show") await startRecording(page);

  await say(page, "1 · 첫 화면", "서비스 첫 화면", ["여기에 이 장면에서 볼 것을 한두 줄로 씁니다."], 3000);

  const target = page.locator("h1, h2, [role=heading], main, form, button");
  await seen(target, "보여 줄 요소");
  await mark(target);
  await say(page, "2 · 보여 줄 것", "하이라이트한 부분", ["화면 글자는 「」로 그대로 인용합니다."], 4000);

  await sayEnd(page);
} catch (e) {
  console.error("오류:", String(e).slice(0, 400));
  process.exitCode ||= 1;
} finally {
  await stopRecording(page).catch((e) => {
    console.error("영상 저장 실패:", String(e).slice(0, 400));
    process.exitCode ||= 1;
  });
}
await finish(browser);
