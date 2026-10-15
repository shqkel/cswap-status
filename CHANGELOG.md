# 변경 이력

버전은 [유의적 버전](https://semver.org/lang/ko/)을 따릅니다. `.claude-plugin/plugin.json`의 `version`과 git 태그 `vX.Y.Z`를 함께 올립니다.

## 1.1.1 — 2026-10-15

### 고침
- macOS: `○`/`●`로 감시를 꺼도 약 10초 뒤 다시 켜지던 문제. `launchctl submit -l cswap-status.auto`가 `local.cswap-status.auto`로 등록되는데 끌 때 원래 이름으로만 지워서 launchd 작업이 남아 있었다. 이 때문에 `switch`를 누른 뒤 `●`로 돌아오거나 두 번 눌러야 꺼진 것처럼 보였다.

## 1.1.0 — 2026-10-15

첫 공개 버전.
- 프롬프트 위 띠: 계정별 5h·7d·모델 사용량, `◀`/`▶` 계정 넘기기, `switch`, `aut`(`cswap auto --once`)
- `○`/`●` 전역 자동 전환 감시 (macOS launchd · Linux systemd --user · Windows 숨김 프로세스)
- cswap 미설치 시 `install`(uv → pipx), 계정 없으면 `add`
