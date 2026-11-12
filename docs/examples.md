# 예제 실행과 녹화

[README로 돌아가기](../README.md)

아래 명령은 저장소 루트에서 실행합니다. Node.js 20 이상과 Google Chrome이 필요합니다.

예제로 포함된 Todo List는 할 일을 추가하고 완료합니다. 계정이나 API 없이 실행할 수 있습니다.

첫 번째 터미널에서 예제 서버를 켭니다.

```bash
node examples/sample-app.mjs
```

다른 터미널에서 장면을 확인합니다.

```bash
DEMO_DIR="$(bash scripts/install.sh)"
DRY=1 node "$DEMO_DIR/sample.mjs"
```

`CHECKS 3/3 OK`가 나오면 Chrome에서 재생합니다.

```bash
node "$DEMO_DIR/sample.mjs"
```

재생이 끝나도 창은 열려 있습니다. 창을 닫으면 명령이 종료됩니다. 영상을 저장하려면 녹화 준비 단계부터 `RECORD=1`을 붙입니다.

```bash
DEMO_DIR="$(RECORD=1 bash scripts/install.sh)"
RECORD=1 DRY=1 node "$DEMO_DIR/sample.mjs"
RECORD=1 node "$DEMO_DIR/sample.mjs"
```

예제 서버를 끈 뒤 `bash tests/smoke.sh`를 실행하면 Todo List, 로그인 3가지 모드, 데이터 정리, 화면 확인 실패, 외부 HTTP·WebSocket 차단을 검사할 수 있습니다. 창 닫기, 종료 신호, 시간 만료, `KEEP=1` 동작은 `DEMO_DIR="$(bash scripts/install.sh)" node tests/lifecycle.mjs`로 확인합니다.

두 번째 영상은 Vite에서 수정 전 모듈을 띄운 뒤 같은 창에서 현재 모듈로 전환합니다. 예제 서버를 켜려면 처음 한 번 Vite를 설치해야 합니다.

```bash
npm --prefix examples/before-after install
npm --prefix examples/before-after run dev
```

다른 터미널에서 시연합니다.

```bash
DEMO_DIR="$(RECORD=1 bash scripts/install.sh)"
RECORD=1 DRY=1 node "$DEMO_DIR/before-after.mjs"
RECORD=1 node "$DEMO_DIR/before-after.mjs"
```
