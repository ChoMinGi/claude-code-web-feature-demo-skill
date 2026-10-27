const button = document.querySelector("button");
const status = document.querySelector('[role="status"]');

button.addEventListener("click", () => {
  status.textContent = "저장 중…";
  setTimeout(() => { status.textContent = "저장 완료"; }, 300);
});
