import { createServer } from "node:http";

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Todo List 예제</title>
  <style>
    body { margin: 0; background: #f4f6f8; color: #14213d; font: 16px/1.5 system-ui, sans-serif; }
    main { width: min(640px, calc(100% - 40px)); margin: 80px auto; padding: 36px; background: white; border-radius: 18px; box-shadow: 0 12px 40px #14213d14; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    p { margin: 0 0 30px; color: #53627a; }
    .input-label { display: block; margin-bottom: 8px; font-weight: 600; }
    .row { display: flex; gap: 10px; }
    #title { flex: 1; min-width: 0; padding: 12px; border: 1px solid #b8c3d4; border-radius: 9px; font: inherit; }
    button { padding: 12px 20px; border: 0; border-radius: 9px; background: #2255cc; color: white; font: inherit; cursor: pointer; }
    ul { margin: 28px 0 0; padding: 0; list-style: none; }
    li { padding: 14px 16px; border: 1px solid #dbe2eb; border-radius: 9px; }
    li + li { margin-top: 10px; }
    li label { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    li input { width: 18px; height: 18px; accent-color: #2255cc; }
    li.completed span { color: #71809b; text-decoration: line-through; }
  </style>
</head>
<body>
  <main>
    <h1>Todo List</h1>
    <p>할 일을 추가하고 완료해 보세요.</p>
    <label class="input-label" for="title">할 일</label>
    <form id="form" class="row">
      <input id="title" autocomplete="off">
      <button type="submit">추가</button>
    </form>
    <ul aria-label="할 일 목록"></ul>
  </main>
  <script>
    document.querySelector("#form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.querySelector("#title");
      const title = input.value.trim();
      if (!title) return;
      const item = document.createElement("li");
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      const text = document.createElement("span");
      checkbox.type = "checkbox";
      checkbox.addEventListener("change", () => item.classList.toggle("completed", checkbox.checked));
      text.textContent = title;
      label.append(checkbox, text);
      item.append(label);
      document.querySelector("ul").append(item);
      input.value = "";
    });
  </script>
</body>
</html>`;

createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}).listen(18474, "127.0.0.1", () => {
  console.log("샘플 서비스: http://127.0.0.1:18474/");
});
