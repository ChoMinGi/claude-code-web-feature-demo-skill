import { assertLocalUrl, openBrowser, startRecording, stopRecording, say, sayEnd, seen, mark, unmark, finish } from "./demo-kit.mjs";

const url = assertLocalUrl(process.env.DEMO_URL ?? "http://127.0.0.1:18474/", "DEMO_URL");
const { browser, page } = await openBrowser();

try {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await startRecording(page);

  const heading = page.getByRole("heading", { name: "Todo List" });
  await seen(heading, "Todo List 제목");
  await mark(heading);
  await say(page, "1 · 시작", "Todo List", ["할 일을 추가하고 완료하는 흐름을 보여줍니다."], 2200);
  await unmark(page);

  await page.getByRole("textbox", { name: "할 일" }).fill("데모 화면 확인");
  await page.getByRole("button", { name: "추가" }).click();
  const list = page.getByRole("list", { name: "할 일 목록" });
  const item = list.getByText("데모 화면 확인", { exact: true });
  await seen(item, "추가된 할 일");
  await mark(item);
  await say(page, "2 · 추가", "할 일이 추가됐습니다", ["목록에 「데모 화면 확인」이 나타납니다."], 2200);
  await unmark(page);

  await page.getByRole("checkbox", { name: "데모 화면 확인" }).check();
  const completed = list.locator("li.completed");
  await seen(completed, "완료한 할 일");
  await mark(completed);
  await say(page, "3 · 완료", "할 일을 완료했습니다", ["체크하면 완료한 항목으로 표시됩니다."], 2400);

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
