#!/usr/bin/env bash
# 데모 도구·어댑터·템플릿을 실행할 자리에 복사하고 그 경로를 출력한다. 대상 서비스의 소스와 Git 상태는 건드리지 않는다.
#
# 사용: install.sh [Playwright 를 가진 폴더]
#   - 폴더를 주고 그 안의 node_modules 에 @playwright/test·playwright·playwright-core 중 하나가 있으면
#     <폴더>/node_modules/.demo/ 에 복사한다(node_modules 라 git 에 잡히지 않는다).
#   - 폴더가 없거나 Playwright 가 없으면 독립 실행기 ~/.cache/web-feature-demo/runner/ 에 playwright-core 를 설치하고 거기 복사한다.
#     이 경우 브라우저는 설치된 Chrome 을 쓴다(DEMO_CHANNEL=chrome, 기본값).
#   - RECORD=1 이면 녹화에 필요한 Playwright FFmpeg 도 설치한다.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TARGET="${1:-}"
PW_VERSION="1.62.1"

has_pw() {
  for name in @playwright/test playwright playwright-core; do
    if [ -f "$1/node_modules/$name/package.json" ]; then
      node -e 'const [major, minor] = require(process.argv[1]).version.split(".").map(Number); process.exit(major > 1 || (major === 1 && minor >= 59) ? 0 : 1)' "$1/node_modules/$name/package.json"
      return $?
    fi
  done
  return 1
}

if [ -n "$TARGET" ] && has_pw "$TARGET"; then
  BASE="$TARGET"
  DEST="$TARGET/node_modules/.demo"
else
  RUNNER="${XDG_CACHE_HOME:-$HOME/.cache}/web-feature-demo/runner"
  if ! has_pw "$RUNNER"; then
    mkdir -p "$RUNNER"
    [ -f "$RUNNER/package.json" ] || echo '{ "private": true, "type": "module" }' > "$RUNNER/package.json"
    echo "Playwright 가 없어 독립 실행기에 playwright-core@$PW_VERSION 를 설치한다: $RUNNER" >&2
    (cd "$RUNNER" && npm install --silent "playwright-core@$PW_VERSION" >&2)
  fi
  BASE="$RUNNER"
  DEST="$RUNNER/demos"
fi

if [ "${RECORD:-}" = "1" ]; then
  if [ -x "$BASE/node_modules/.bin/playwright" ]; then
    "$BASE/node_modules/.bin/playwright" install ffmpeg
  else
    "$BASE/node_modules/.bin/playwright-core" install ffmpeg
  fi
fi

mkdir -p "$DEST/adapters"
cp "$HERE/demo-kit.mjs" "$DEST/"
cp "$HERE"/adapters/*.mjs "$DEST/adapters/"
cp "$HERE"/examples/*.mjs "$DEST/"
echo "$DEST"
