---
name: web-feature-demo
description: 로컬 웹 서비스를 Chrome에서 장면별로 시연한다. 한국어 설명과 화면 하이라이트를 표시하며, 선택하면 WebM 영상도 저장한다. 기능 변경 시연, 사용자 흐름 데모, 특정 장면 재생 요청에 사용한다.
---

# 웹 기능 데모

로컬에서 실행 중인 웹 서비스를 Chrome에서 재생한다. 장면마다 한국어 설명을 띄우고 볼 부분을 하이라이팅한다. 재생이 끝나면 창을 열어 둔다.

사용자 요청: $ARGUMENTS

스킬에 포함된 파일은 `${CLAUDE_SKILL_DIR}`를 기준으로 찾는다.

## 시작 전 확인

요청과 현재 작업 맥락에서 시연 대상과 아래 옵션을 확인한다. 이미 정해진 항목은 다시 묻지 않는다. 빠진 항목이 있으면 한 번에 묻는다.

| 항목 | 선택지 | 적용 |
|---|---|---|
| 영상 | Chrome 시연만 / 시연과 WebM 저장 | 저장할 때 `RECORD=1` |
| 로그인 | 필요 없음 / 시연 전에 로그인 / 로그인 과정도 시연 | 각각 `DEMO_LOGIN_MODE=none`, `before`, `show` |

질문 예: “영상은 저장할까요(시연만/WebM 저장)? 로그인은 어떻게 다룰까요(없음/시연 전/과정 포함)?”

로그인에 SSO·2단계 인증이 필요하거나 로그인 폼이 일반적인 이메일·비밀번호 형태가 아니라면 방법을 확인하고 `${CLAUDE_SKILL_DIR}/references/adapters.md`를 따른다. 비밀번호와 토큰은 대화나 스크립트에 적지 않고 환경 변수로 받는다.

대상, 장면 순서, 예상 길이, 영상·로그인 선택을 짧게 정리해 사용자에게 먼저 보여 준다. 장면과 설명은 `${CLAUDE_SKILL_DIR}/references/brief.md`를 따른다.

## 실행

1. 프론트엔드와 필요한 백엔드가 로컬에서 실행 중인지 확인한다. `DEMO_URL`, `DEMO_LOGIN_URL`, `DEMO_API`에는 루프백 주소만 쓴다. 브라우저의 외부 HTTP(S)·WebSocket 요청은 차단되지만 서버 측 요청은 검사할 수 없으므로 백엔드 설정도 확인한다.
2. `bash "${CLAUDE_SKILL_DIR}/scripts/install.sh" "${CLAUDE_PROJECT_DIR}"`를 실행한다. Playwright가 다른 앱 폴더에 있으면 그 경로를 대신 전달한다. 출력된 설치 폴더에서 `template.mjs`를 복사해 장면 스크립트를 만든다. Playwright가 없으면 독립 실행기를 설치한다. 영상을 저장할 때는 설치 명령에도 `RECORD=1`을 준다.
3. 장면마다 화면을 조작하고 그 장면의 결과를 특정하는 요소를 `seen(요소, 이름)`으로 확인한 뒤 `mark(요소)`와 `say(page, 단계, 제목, 설명[], 시간)`을 호출한다. 다음 장면에서는 `unmark(page)`로 이전 하이라이트를 지운다. `seen`이 실패하면 재생이 중단된다. 로그인 옵션에 맞춰 `DEMO_LOGIN_MODE`를 설정하고, 영상 저장을 선택했다면 실행 명령에 `RECORD=1`을 준다.
4. 데모 데이터를 만들었다면 생성 직후 정리 작업을 등록한다. 화면에서 만든 데이터도 포함한다. 브라우저 종료 후에도 API 정리가 필요하면 `${CLAUDE_SKILL_DIR}/references/adapters.md`의 `requestForApi`를 쓴다. 서버 오류는 `inject()`, 오프라인은 `context.setOffline(true)`, 수정 전 화면은 `${CLAUDE_SKILL_DIR}/references/before-after.md`를 참고한다.
5. `DRY=1 node <설치 폴더>/<스크립트>.mjs`로 창 없이 확인한다. 영상을 저장할 때는 이 명령에도 `RECORD=1`을 주어 같은 화면 크기로 확인한다. `DRY=1`에서는 실제 녹화가 이뤄지지 않는다. 종료 코드가 0이고 `CHECKS n/n OK`에서 n이 1 이상이어야 재생한다. `MISS`, 원격 요청 차단, 한국어 문구 경고가 있으면 원인을 확인한다. 화면 동작이 기대와 다르면 결함으로 알린다.
6. 앞 데모 창이 있으면 닫고 데이터 정리가 끝났는지 확인한다. 새 데모를 Chrome에서 재생하고 첫 장면이 표시되는지 확인한다. 재생 중에는 소스를 수정하지 않는다. 마지막 장면에는 `sayEnd(page)`를 사용한다.

성공적으로 재생한 뒤에는 창을 열어 둔다. 창을 닫거나 30분이 지나면 등록한 정리 작업이 실행된다. `SIGINT`·`SIGTERM` 종료에도 정리를 시도한다. `KEEP=1`이면 데이터를 남긴다. 녹화했다면 `stopRecording(page)` 후 영상 경로를 알려 준다.

## 파일 안내

아래 경로는 `${CLAUDE_SKILL_DIR}` 기준이다.

- `scripts/demo-kit.mjs`: 브라우저, 설명, 하이라이트, 화면 확인, 오류 주입, 녹화, 데이터 정리
- `scripts/adapters/generic.mjs`: 일반적인 이메일·비밀번호 로그인과 API 호출
- `scripts/examples/template.mjs`: 장면 스크립트 예시와 로그인·녹화 순서
- `examples/sample-app.mjs`, `scripts/examples/sample.mjs`, `examples/sample.png`, `examples/sample.webm`: 할 일 추가·완료 예제
- `examples/before-after/`, `scripts/examples/before-after.mjs`, `examples/before-after.png`, `examples/before-after.webm`: Vite 수정 전후 비교 예제
- `tests/smoke.sh`: 샘플 시연과 원격 주소 거부 확인
- `references/adapters.md`: 서비스별 로그인·데이터 준비가 필요할 때
- `references/before-after.md`: 수정 전후 비교가 필요할 때
- `references/pitfalls.md`: 재생 중 문제가 생겼을 때

## 기준

- 설명은 한국어로 쓴다. 화면 문구는 그대로 인용하고, 코드 이름이나 검증 번호는 시청자용 설명에 넣지 않는다.
- 데모는 테스트 판정이 아니다. 화면과 API 등으로 확인하지 않은 로그인, 저장, 사용자별 데이터 범위는 설명에 쓰지 않는다. 수정 전 동작도 실제로 확인해야 한다.
- 대상 서비스의 소스와 실행 중인 서버를 데모 때문에 바꾸지 않는다.
- 녹화는 웹페이지 화면만 WebM으로 저장한다. 주소창과 다른 앱은 포함되지 않는다. `DRY=1`에서는 녹화하지 않는다. 공유 전 계정 정보와 개인 정보가 보이는지 확인한다.
- 로그인 과정을 녹화할 때는 데모 계정을 사용한다. SSO나 2단계 인증은 범용 로그인으로 처리하지 않고 서비스별 어댑터가 필요한 것으로 알린다.
