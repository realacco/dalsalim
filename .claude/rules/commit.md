# 커밋 규칙 · 훅 · CI

> **언제 읽나:** 커밋 메시지를 쓸 때 · scope 를 고를 때 · 훅이나 CI 가 막았을 때.
`commitlint.config.mjs` 가 이 문서의 기계 판정본이다. 둘이 다르면 이 문서가 맞다.

형식은 Conventional Commits, 제목과 본문은 한국어로 쓴다.

```
type(scope): 한국어 한 줄 요약

왜 이렇게 했는지. 판단의 근거, 버린 대안, 알려진 한계.
diff를 읽으면 아는 "무엇을 바꿨는지"는 반복하지 않는다.

Feature: F-FAM-05, F-BOOK-04
Closes #12
Co-Authored-By: ...
```

- **type** — `feat` / `fix` / `refactor` / `test` / `docs` / `style` / `perf` / `chore`
- **scope** — 변경의 무대. 아래 15개만 쓴다 (`commitlint.config.mjs` 가 막는다).
  여러 영역에 걸치면 생략한다. 자꾸 걸치면 커밋을 쪼갤 신호다.

  | 묶음 | scope | 무엇을 |
  |---|---|---|
  | **도메인 5** | `session` | 로그인 · 토큰 · 게이트 (`F-SES`) |
  | | `family` | 가족 · 초대코드 · 승인 · 구성원 (`F-FAM`) |
  | | `fixed-expense` | 고정비 항목 — 매달 템플릿이 되는 것 (`F-FIX`) |
  | | `book` | 월 장부 · 요약 · 추이 · 상태 (`F-BOOK`) |
  | | `entry` | 기록 · 줄 · 사유 · 제출 (`F-ENT`) |
  | **화면** | `wizard` | 입력 위저드. entry 도메인이지만 앱에서 가장 큰 슬라이스라 따로 부른다 |
  | | `ui` | `shared/ui` 공용 컴포넌트 · `shared/config` 디자인 토큰 |
  | **무대** | `server` `mobile` | 도메인 하나에 안 붙는 전반 변경 |
  | **도구** | `prisma` | 스키마 · 마이그레이션 |
  | | `lint` | eslint · prettier · husky · commitlint |
  | | `ci` | GitHub Actions |
  | | `deploy` | Railway · EAS |
  | | `deps` | 의존성 추가 · 갱신 |
  | **문서** | `plan` | 기획서 · 출시 체크리스트 · 태스크 문서 |

  도메인 5개는 기획서의 기능 ID · `server/routes` · `mobile/entities` 와 모두 같은 축이다.
  같은 변경이 `entry` 인지 `wizard` 인지 헷갈리면: **서버는 `entry`, 앱의 위저드 화면은 `wizard`.**
- **제목** — 50자 내외, 마침표 없음, 체언 종결(`~ 추가`, `~ 수정`). 코드 식별자는 영어 그대로.
- **본문은 "왜"를 쓴다.** 한 줄로 자명한 변경은 생략 가능하지만,
  판단이 들어간 변경(설계 선택, 우회, 트레이드오프)은 본문 필수.
- **한 커밋 = 한 가지 변경.** 포맷과 로직, 기능 추가와 리팩터링을 섞지 않는다.
- **깨진 상태를 커밋하지 않는다.** 커밋 전에 `typecheck` + 스모크를 통과시킨다.
- **기획 결정이 바뀐 커밋**은 본문에 기획서의 어느 장이 바뀌었는지 함께 적는다 (SSOT 규칙).
- **도메인 하드룰을 건드리는 커밋**은 본문에 준수 근거를 남긴다.
  (예: "name/category는 계속 복사한다 — 항목 이름 변경이 과거 기록을 흔들면 안 되므로")
- **브랜치 이름**은 `<type>/<F-ID>-<kebab>` — `feat/F-BOOK-03-trend-tab`.
  `feat/` 만 기능 ID 가 필수다 (위 「작업 흐름」 참조).
- **`Feature:` 트레일러**로 기능 ID 를 남긴다. 제목에 넣으면 50자 규칙과 싸우고,
  트레일러는 `git log --format='%(trailers:key=Feature,valueonly)' -- <경로>` 로 기계가 읽는다.
  **애매하면 생략해도 된다** — 억지로 붙인 ID 는 나중에 검색을 오염시킨다.
- 이슈를 닫는 커밋에는 `Closes #12` 를 같이 적는다.
- 에이전트가 작성한 커밋은 `Co-Authored-By` 트레일러를 남긴다.

### 커밋할 때 자동으로 도는 것 (husky)

| 훅 | 무엇을 | 왜 |
|---|---|---|
| `pre-commit` | **비밀 스캔** (`scripts/scan-secrets.mjs`) | 저장소가 PUBLIC 이다. 한 번 push 된 비밀은 히스토리를 다시 쓰기 전까지 남는다 |
| | 스테이징된 파일만 prettier + `eslint --fix` | 전체 lint 는 8초다. 느린 훅은 `--no-verify` 로 우회당한다 |
| | **1층 테스트** (vitest) | 0.5초라 매 커밋에 돌릴 값어치가 있다. 스모크는 CI 로 보낸다 |
| | **건드린 쪽만** typecheck | 양쪽 다 돌리면 8초, 한쪽이면 4초 |
| `commit-msg` | commitlint — type · scope · 제목 길이 · 마침표 · 본문 빈 줄 | 규칙을 문서에만 적어두면 지켜지는지 아무도 모른다 |

- **검사하지 않는 것**: 체언 종결(`~ 추가`) · 본문의 "왜" · 스모크.
  기계가 판정할 수 없어서 뺀 것이지 규칙이 아니어서가 아니다. 스모크는 CI 의 몫이다

### CI (GitHub Actions — `.github/workflows/ci.yml`)

훅이 "바뀐 것만" 보는 대신 CI 는 **전체**를 본다. PR 과 `main` push 에 돈다.

| job | 무엇을 | 왜 따로인가 |
|---|---|---|
| `check` | 포맷 검사 · 전체 lint · 전체 typecheck · 1층 테스트 | 훅을 `--no-verify` 로 우회한 커밋이 여기서 걸린다 |
| `smoke` | Postgres 컨테이너 → `migrate deploy` → 서버 기동 → 스모크 전체 | 훅에서는 DB 를 띄울 수 없다. **운영과 같은 마이그레이션 경로**를 매번 밟는다 |

- 두 job 은 서로 기다리지 않는다. 둘 다 빨간 것과 하나만 빨간 것은 원인이 다르다.
- CI 가 빨간 채로 머지하지 않는다. 로컬에서 `npm run lint && npm run typecheck && npm test` 와
  스모크를 돌리면 CI 와 같은 것을 본 것이다.
- 비밀 스캔이 자리표시자를 잘못 잡으면 그 줄 끝에 `secret-scan:allow` 를 적는다.
  규칙 자체를 고치면 `tests/tools/scan-secrets.test.mjs` 에 케이스를 같이 넣는다
- **`--no-verify` 는 쓰지 않는다.** 훅이 막았으면 막힐 이유가 있다

