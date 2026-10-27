import { assertLocalUrl, openBrowser, startRecording, stopRecording, say, sayEnd, seen, mark, unmark, finish } from "./demo-kit.mjs";

const url = assertLocalUrl(process.env.DEMO_URL ?? "http://127.0.0.1:18475/", "DEMO_URL");
const { browser, page } = await openBrowser({
  swap: { "/src/main.js": "/src/previous.js" },
  swapBase: url,
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await startRecording(page);

  const heading = page.getByRole("heading", { name: "알림 설정" });
  await seen(heading, "이전 화면 제목");
  await mark(heading);
  await say(page, "1 · 이전", "수정 전 화면", ["「저장」을 누른 뒤 상태를 확인합니다."], 2500);
  await unmark(page);

  await page.getByRole("button", { name: "저장" }).click();
  await page.waitForTimeout(500);
  const oldStatus = page.getByRole("status").filter({ hasText: "저장 중…" });
  await seen(oldStatus, "이전 화면의 저장 상태");
  await mark(oldStatus);
  await say(page, "2 · 이전 결과", "상태가 바뀌지 않습니다", ["「저장 중…」이 계속 표시됩니다."], 3000);
  await unmark(page);

  await page.unrouteAll({ behavior: "wait" });
  await page.reload({ waitUntil: "domcontentloaded" });
  await seen(heading, "현재 화면 제목");
  await mark(heading);
  await say(page, "3 · 현재", "현재 화면", ["같은 창에서 현재 버전을 확인합니다."], 2500);
  await unmark(page);

  await page.getByRole("button", { name: "저장" }).click();
  const newStatus = page.getByRole("status").filter({ hasText: "저장 완료" });
  await seen(newStatus, "현재 화면의 저장 상태");
  await mark(newStatus);
  await say(page, "4 · 현재 결과", "저장 결과가 표시됩니다", ["「저장 완료」로 바뀝니다."], 3200);

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
