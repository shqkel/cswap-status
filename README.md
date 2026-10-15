# cswap-status

[claude-swap](https://github.com/realiti4/claude-swap)(`cswap`) 계정 사용량을 Claude Code 프롬프트 바로 위에 한 줄로 띄우는 mod입니다.

```
◀ alice 5h 6% · 7d 26% · Fable 0% ▶  switch aut○
```

| 요소 | 동작 |
|---|---|
| `◀` `▶` | 이전·다음 계정의 사용량 보기 (활성 계정은 굵게·강조색) |
| `5h n%` 색 | 70% 미만 초록 · 70% 이상 노랑 · 90% 이상 빨강 |
| `switch` | 보고 있는 계정으로 전환. 활성 계정을 보고 있으면 다음 계정으로 |
| `aut` | `cswap auto --once` — 자동 전환 판단을 한 번만 |
| `○` / `●` | 전역 자동 전환 감시(`cswap auto`) 켜기·끄기. 켜지면 초록 `●` |

## 설치

Claude Code 프롬프트에서:

```
/plugin install cswap-status --marketplace shqkel/cswap-status
```

`y`로 마켓플레이스를 추가하고, 범위는 **user**를 고르면 모든 세션에서 쓰입니다.

### cswap 설치

cswap이 없으면 띠에 `cswap 미설치 install`이 뜹니다. `install`을 누르면 `uv tool install claude-swap`, 그다음 `pipx install claude-swap` 순으로 시도합니다. 둘 다 없으면 [uv](https://docs.astral.sh/uv/)를 먼저 설치하세요.

설치 후 계정이 없으면 `cswap 계정 없음 add`가 뜹니다. `add`는 지금 로그인한 Claude 계정을 등록합니다(`cswap add`). 다른 계정은 그 계정으로 로그인한 뒤 다시 `add`를 누르거나 터미널에서 `cswap add`를 실행하세요.

## 전역 감시 (`○`/`●`)

감시는 **컴퓨터에 하나만** 돕니다. 어느 세션에서 켜든 끄든 같은 프로세스이고, Claude Code를 모두 닫아도 계속 돕니다. 각 세션은 60초마다 실제로 돌고 있는지 확인해 `●`/`○`를 그립니다.

| OS | 띄우는 방식 | 로그 |
|---|---|---|
| macOS | launchd 작업 `cswap-status.auto` (`launchctl submit`) | `~/Library/Logs/cswap-auto.log` |
| Linux | systemd 사용자 유닛 `cswap-status-auto` (`systemd-run --user`). systemd가 없으면 `setsid nohup` | `journalctl --user -u cswap-status-auto` 또는 `~/.local/state/cswap-auto.log` |
| Windows | 숨김 프로세스 (`Start-Process -WindowStyle Hidden`) | `%LOCALAPPDATA%\cswap-auto\` |

- `●`를 누르면 이 mod가 띄운 것뿐 아니라 터미널에서 직접 띄운 `cswap auto`도 함께 멈춥니다.
- 재부팅 뒤에는 꺼진 상태로 시작합니다. 다시 `○`를 누르세요.
- 전환 기준(기본 90%)·간격(60초)은 cswap 설정을 따릅니다: `cswap config set autoswitch.threshold 80`

## 검증 상태

| OS | 상태 |
|---|---|
| macOS | 실사용 확인 |
| Linux | 명령 생성만 테스트, 실기기 미검증 |
| Windows | 명령 생성만 테스트, 실기기 미검증 |

## 변경 이력

[CHANGELOG.md](CHANGELOG.md)

## 개발

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .        # 이 폴더를 불러온 세션
```
