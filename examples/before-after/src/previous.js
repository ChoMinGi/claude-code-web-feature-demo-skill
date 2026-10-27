const button = document.querySelector("button");
const status = document.querySelector('[role="status"]');

button.addEventListener("click", () => {
  status.textContent = "저장 중…";
});
