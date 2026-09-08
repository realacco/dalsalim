# 달살림

**우리 가족, 한 달 살림을 폰으로 같이 적는다.**

가족 가계부를 엑셀로 쓰다가 만들었다. 템플릿을 매번 만들고, 매월 시트를 복사하고,
그걸 하려면 데스크톱을 켜야 하는 게 싫어서다.

카드 내역을 자동으로 긁어오지 않는다. 대신 **초기에 등록한 고정비 항목이 매달 템플릿이 되고**,
버튼 하나로 지난달 값이 채워진 채 열린다. 그리고 **금액이 달라진 줄에만 이유를 묻는다.**

```
관리비   [ 180,000 ]  ← 지난달과 같음. 그냥 다음.
관리비   [ 240,000 ]  ← 6만원 더 나왔네? "왜 이랬어?" (필수 입력)
```

📄 **[MVP 기획서](https://app.notion.com/p/83a8a87802e0403c9b36968fedc61487)** ·
**[기능 정의서](https://app.notion.com/p/e0553e31bebf46babb92a38c9b1deb34)** (원본은 Notion) ·
**[MVP 출시 체크리스트](docs/02-MVP-출시-체크리스트.md)**

> 지금은 **MVP 단계**다. 빠르게 만들어 몇 달 써보고 방향을 잡는 게 목적이다.

---

## 빠르게 실행하기

터미널 두 개가 필요하다. 그 전에 **저장소 루트에서 한 번**:

```bash
npm install   # 최초 1회 — 커밋 훅(husky)이 여기서 설치된다
```

```bash
# 1번 터미널 — API 서버
cd server
cp .env.example .env          # 최초 1회 — DATABASE_URL 을 채운다 (아래 참조)
npm install                   # 최초 1회
npm run db:deploy             # 최초 1회 (스키마 생성)
npm run seed                  # 최초 1회 (데모 가족 '김씨네')
npm run dev                   # → http://localhost:4000
```

> **DB 는 Postgres 다.** SQLite 는 더 이상 쓰지 않는다 —
> 운영과 같은 엔진으로 개발해야 "내 노트북에선 됐는데"가 안 생기고,
> 연 고정비의 `months`(정수 배열)가 SQLite 에서는 표현되지 않는다. (기획서 7.4)
>
> `DATABASE_URL` 은 둘 중 하나로 채운다.
> - **Railway 개발용 DB** (권장) — 운영과 완전히 같은 환경. 아래 "배포" 참조
> - **로컬 Docker** — `docker run -d --name dalsalim-pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=dalsalim postgres:16`

```bash
# 2번 터미널 — 앱
cd mobile
npm install                   # 최초 1회
npm run dev -- --android      # 에뮬레이터 자동 부팅 + adb reverse + Expo Go 실행
```

`npm run dev`가 알아서 해주는 것:

- `dalsalim` AVD 부팅 (기기가 하나도 없을 때만)
- `adb reverse`로 **8081**(Metro)과 **4000**(API)을 에뮬레이터에 터널링
- API 서버가 살아 있는지 확인하고, 꺼져 있으면 알려준다

옵션: `--no-emu`(에뮬레이터 자동 실행 끄기), `--clear`(Metro 캐시 초기화)

### 처음 켰을 때 뭘 눌러야 하나

카카오 앱 키를 아직 안 넣었다면 로그인 화면에 **개발용 로그인**이 뜬다.
이름에 `아빠` 또는 `엄마`를 넣으면 데모 가족 '김씨네'로 바로 들어간다.
(지난달 기록이 이미 있어서, 이번 달을 적어보면 지난달 금액이 기본값으로 깔린다)

---

## 구조

```
dalsalim/
├── docs/
│   ├── 01-MVP-기획서.md            차례 + Notion 링크 (본문은 Notion 이 원본)
│   ├── 02-MVP-출시-체크리스트.md    실제로 쓰기 시작하기까지 남은 일
│   ├── 03-MVP-시행착오.md          실제로 데인 것들
│   └── 04-기능-정의서-인덱스.md     기능 ID ↔ 코드 경로. 코드 만지기 전에 grep
│
├── tests/                    루트 테스트 — contract(서버/앱 사본 일치) · tools(커밋 훅)
├── .github/workflows/ci.yml  check(lint·typecheck·1층) + smoke(Postgres)
│
├── server/                   Fastify + Prisma + Postgres · 레이어드
│   ├── prisma/schema.prisma    데이터 모델 (원본)
│   ├── prisma/migrations/      마이그레이션 (커밋 대상)
│   ├── src/routes/             auth · families · join-requests · fixedExpenses · books · entries
│   │                           (얇게 — prisma 를 직접 부르지 않는다)
│   ├── src/services/           family · fixed-expense · book(완성 판정·집계) · entry(프리필)
│   ├── src/lib/                db · auth(가드) · http(에러) · messages(코드→문장) ·
│   │                           schemas(공용 zod) · shared(상수·순수함수)
│   └── scripts/smoke.mjs       전 구간 스모크 테스트
│
└── mobile/                   Expo (React Native) + expo-router · FSD
    ├── src/app/                expo-router 라우트 — screens 를 re-export 만 한다
    ├── src/screens/            gate · login · onboarding · pending · this-month ·
    │                           fixed-expenses · family · wizard · month-summary · trend
    │                           (큰 화면은 index.tsx + model/ + ui/)
    ├── src/entities/           session · family · fixed-expense · book · entry
    │                           (도메인별 api + model)
    ├── src/widgets/            tab-bar
    ├── src/shared/             ui · config(theme · messages) · lib(format · errors · confirm) ·
    │                           api(client) · model(types)
    └── scripts/                dev.js · emulator.js
```

## 개발 프로세스

**GitHub 이슈를 축으로 돈다.** 기능 하나 = 이슈 하나 = 브랜치 하나 = PR 하나이고,
이슈가 닫히면 다시 보지 않는다.

```
① 기능 정의서(Notion) + 기획서의 해당 절을 읽는다
② 주석·인덱스로 지금 코드가 어디까지 와 있는지 본다
③ 태스크를 산정해 확인받는다            ← 여기서 한 번 멈춘다
④ 이슈        [F-FAM-05] 참여 요청 승인·거절
⑤ 브랜치      feat/F-FAM-05-approve-join
⑥ 커밋        Feature: F-FAM-05  /  Closes #12
⑦ PR → CI → 머지 → 이슈 닫힘
```

### 이슈를 만드는 네 가지 경우

**대부분의 일은 이 사이클을 밟지 않는다.** 기본은 브랜치 → 작업 → PR 이고 이슈는 없다.
PR 이 기록이다. 즉흥으로 부탁한 작은 수정에까지 문서와 이슈를 요구하면 규칙이 통째로 우회당한다.

가르는 축은 **"중요한가" 가 아니라 "되돌릴 수 있나"** 다. 되돌리기 어려운 네 가지일 때만 이슈를 만든다.

| 트리거 | 어떻게 알아채나 |
|---|---|
| `/task` 를 부르거나 "새 기능" 이라고 말한다 | 명시적이다 |
| 커밋이 `feat` 가 된다 (사용자에게 보이는 새 동작) | type 은 어차피 골라야 하는 값이다 |
| **하드룰이 걸린 파일**을 고친다 | 파일을 열 때 훅이 띄워준다 |
| **`server/prisma/schema.prisma`** 를 고친다 | 마이그레이션은 되돌리기 어렵다 |

걸리면 **묻지 말고 이슈를 만든다.** "애매한가?" 를 판단하기 시작하면 그 판단이 매번 흔들린다.
문서는 앞이 아니라 **PR 에서 코드와 같이** 고친다 — 무엇을 만들었는지는 만들고 나야 안다.

### 이름 규칙

| | 형식 | 예 |
|---|---|---|
| 브랜치 | `<type>/<F-ID>-<kebab>` | `feat/F-FAM-05-approve-join` |
| 이슈·PR 제목 | `[F-ID] 기능 이름` | `[F-FAM-05] 참여 요청 승인·거절` |
| 커밋 트레일러 | `Feature: F-ID` (여럿이면 쉼표) | `Feature: F-FAM-05, F-BOOK-04` |
| 테스트 이름 | `★ F-ID 행동` | `★ F-ENT-04 금액이 달라지면 사유 없이는 막힌다` |
| 이슈 라벨 | 도메인 5개 | `session` `family` `fixed-expense` `book` `entry` |

`feat/` 만 기능 ID 가 필수다. **`chore/` `docs/` `ci/` `deps/` 는 없어도 된다** —
오타 수정·의존성 갱신에까지 이슈를 요구하면 규칙이 우회당하므로, 구멍의 모양을 미리 정해 둔 것이다.

### 기계가 지키는 것 / 사람이 지키는 것

| | 무엇을 |
|---|---|
| **파일 편집 직전** | `main` 편집 차단 · `feat/` 인데 기능 ID 없으면 차단 · 걸린 기능과 하드룰 알림 |
| **커밋 직전** | 비밀 스캔 · 포맷 · 1층 테스트 · 타입체크 · **인덱스와 코드 주석 일치** |
| **커밋 메시지** | type · scope · 제목 길이 · `Feature:` 트레일러 형식과 실존 |
| **PR** | CI 전체 (린트 · 타입 · 1층 · 2층) |
| **사람** | 문서를 실제로 읽었는가 · 테스트 이름의 기능 ID · Notion 과 인덱스의 일치 · 3층(에뮬레이터) |

마지막 줄은 기계가 판정할 수 없어서 남긴 것이지 덜 중요해서가 아니다.
**특히 Notion 을 고칠 때는 `docs/04-기능-정의서-인덱스.md` 도 같이 고친다** — 그쪽은 막아주는 장치가 없다.

절차 본문은 `.claude/process/start-task.md`, 규칙은 `CLAUDE.md` 「작업 흐름」에 있다.
`/task <기능 ID>` 로 ① 부터 자동으로 밟을 수 있고, `/spec <파일 · ID · 도메인>` 으로 조회만 할 수도 있다.

---

## 검증

```bash
npm test                              # 1층 — 순수 함수 (루트에서, 0.5초)
cd server && node scripts/smoke.mjs   # 2층 — API 흐름
npm run typecheck                     # 루트에서 — tests + server + mobile
npm run lint                          # 루트에서 — server + mobile
```

검증은 3층이다 — **1층 순수 함수(vitest)** · **2층 API 흐름(스모크)** · **3층 화면(사람)**.
3층은 자동화하지 않는다. 커서 밀림 같은 건 결국 에뮬레이터에서 눌러봐야 안다.

커밋할 때는 훅이 알아서 돈다 — **비밀 스캔** · 바뀐 파일만 lint · **1층 테스트** ·
건드린 쪽만 typecheck · 커밋 메시지 검사(commitlint). PR 을 올리면 **CI** 가 전체 lint·typecheck·테스트와
스모크(Postgres 컨테이너)를 돈다 — `.github/workflows/ci.yml`. 규칙은 `CLAUDE.md` 「커밋 규칙」에 있다.
비밀 스캔이 자리표시자를 잘못 잡으면 그 줄 끝에 `secret-scan:allow` 를 적는다.

스모크 테스트는 기획서 10장의 성공 기준을 그대로 따라간다. 특히 이 넷은 이 앱의 규칙이라 반드시 통과해야 한다.

- 금액이 달라지면 사유 없이는 막힌다
- 금액을 되돌리면 사유도 같이 지워진다
- 지난달에 적은 금액이 이번 달 기본값으로 깔린다
- 다시 열면 장부 상태도 진행 중으로 내려간다

---

## 기술 스택과 그 이유

| 영역 | 선택 | 왜 |
|---|---|---|
| 앱 | **Expo SDK 57 (RN 0.86) + TypeScript** | 안드로이드·iOS 한 코드베이스. 이 PC에 검증된 Expo 환경이 있다 |
| 라우팅 | **expo-router** | 파일 기반. 위저드 같은 깊은 화면 이동이 단순해진다 |
| 서버 상태 | **TanStack Query** | 캐시·재검증·로딩 상태를 직접 안 짜도 된다 |
| 앱 상태 | **zustand** | 세션(토큰·가족) 하나만 전역이면 된다. Redux는 과하다 |
| 스타일 | **StyleSheet + 토큰(`src/shared/config/theme.ts`)** | 아래 참조 |
| 서버 | **Fastify + TypeScript** | 가볍고 빠르다. 라우트 20개 남짓이라 NestJS는 과하다 |
| DB | **Postgres + Prisma** | SQLite 로 시작했다가 배포 직전에 옮겼다. 스키마 한 줄이었고, 마이그레이션만 새로 잡았다. 개발도 같은 엔진을 봐야 "내 노트북에선 됐는데"가 안 생긴다 |
| 인증 | **카카오 REST OAuth + JWT** | 아래 참조 |

**왜 NativeWind를 안 썼나** — Babel 플러그인 + Metro + Tailwind 설정 세 군데를 건드린다.
화면 10개짜리 MVP에서 그 이득보다 빌드 파이프라인 디버깅 비용이 크다.
색·간격·타이포는 `src/shared/config/theme.ts` 한 파일로 충분히 통제된다.

**왜 카카오 네이티브 SDK를 안 썼나** — `@react-native-seoul/kakao-login`은 네이티브 모듈이라
`expo prebuild` + 네이티브 빌드가 필수다. 이 PC에서 그 빌드는 실측 **22분**이고 경로 길이 함정도 있다.
REST OAuth로 하면 **Expo Go로 바로 테스트되고**, 서버가 코드 교환을 맡으므로
REST 키와 client secret이 앱 번들에 들어가지 않는다 — 보안상으로도 이쪽이 낫다.

```
앱 ──브라우저──▶ GET {서버}/auth/kakao/start?returnUrl=exp://...
                   └▶ 302 kauth.kakao.com/oauth/authorize
사용자 동의
카카오 ──▶ GET {서버}/auth/kakao/callback?code&state
             ├ 코드 → 토큰 교환 (서버가 키를 쥐고 있다)
             ├ 프로필 조회 · User upsert · JWT 발급
             └▶ 302 exp://...?token=eyJ...
앱 ──▶ 토큰을 SecureStore에 저장
```

---

## 카카오 로그인 켜기

운영에는 이미 붙어 있다. 아래는 **새 환경을 하나 더 만들 때**(로컬 등) 필요한 절차다.

⚠️ **순서가 강제된다.** Web 플랫폼을 먼저 등록하지 않으면 Redirect URI 칸이 아예 안 나온다.

1. [카카오 개발자 콘솔](https://developers.kakao.com) → 애플리케이션 추가
   (회사명은 필수 칸이다. 개인이면 본인 이름)
2. **앱 설정 → 플랫폼 → Web 플랫폼 등록** — 사이트 도메인에 서버 주소
3. **플랫폼 키 → REST API 키 → 리다이렉트 URI** 에 `<서버주소>/auth/kakao/callback`
   (콘솔 개편 전에는 「제품 설정 → 카카오 로그인」 아래 있었다. 둘 중 보이는 쪽에 넣는다)
4. **카카오 로그인 활성화 ON**
5. **동의항목 → 닉네임(`profile_nickname`)만.** 선택 동의로 충분하다 —
   서버가 없으면 `'이름 없음'` 으로 받고, 사람을 구분하는 건 가족마다 직접 적는 `displayName` 이다
6. REST API 키를 `KAKAO_REST_API_KEY` 에, 서버 주소를 `PUBLIC_BASE_URL` 에 넣는다

**안 해도 되는 것** — Android·iOS 플랫폼 등록 · 키 해시 · 프로필 사진 동의.
네이티브 SDK 를 안 쓰고 브라우저로 도는 REST OAuth 라서다. 프로필 사진은 앱이 그리지 않는다
(`<Image>` 가 한 곳도 없다) — 안 쓰는 개인정보를 받지 않는다.

> `PUBLIC_BASE_URL` 이 비어 있으면 서버가 `redirect_uri` 를 `localhost` 로 만들어
> 카카오가 "등록되지 않은 URI" 로 거절한다. 키보다 이것을 먼저 확인한다.

---

## 버전 정책

`mobile/app.json` 에 세 개의 숫자가 있고 **셋이 서로 다른 것을 뜻한다.** 헷갈리면 OTA 가 조용히 끊긴다.

| | 지금 | 무엇인가 | 언제 올리나 |
|---|---|---|---|
| `version` | `0.1.0` | **사람이 보는 제품 버전** | 아래 규칙대로 |
| `runtimeVersion` | `"1"` | **어떤 네이티브 런타임이 필요한가** | 네이티브를 실제로 건드렸을 때만 |
| `android.versionCode` | `2` | 안드로이드가 "더 새 것"을 판단하는 정수 | **APK 를 새로 구울 때마다 +1** |

### `version` — 0.1.0 에서 시작한다

- **새 기능이 올라가면** 가운데를 올린다 — `0.1.0` → `0.2.0`
- **버그 수정은** 끝을 올린다 — `0.2.0` → `0.2.1`
- **`1.0.0` 은 플레이스토어 정식 출시 때 쓴다.** 그전까지는 0.x 다

### `runtimeVersion` — 함부로 올리지 않는다

**이 값이 같으면 OTA 가 이어진다.** `version` 을 아무리 올려도 상관없다 —
그래서 버그픽스 `0.2.1` 도 재설치 없이 나간다.

⚠️ **네이티브를 건드렸으면 반드시 올린다.** 안 올리면 새 JS 가 옛 런타임에 내려가 앱이 죽는다.

네이티브를 건드린다는 것:

- 새 네이티브 모듈 추가 (`expo install` 로 들어오는 것 대부분)
- `app.json` 의 네이티브 설정 — 아이콘 · 스플래시 · 패키지명 · 플러그인
- Expo SDK 올리기

이때는 어차피 `eas build` 로 APK 를 새로 굽고 가족이 다시 설치해야 한다.
**"재설치가 필요한 변경 = runtimeVersion 을 올리는 변경"** 으로 기억하면 된다.

> `fingerprint` 정책을 쓰지 않는 이유: 그 정책은 `version` 만 바꿔도 지문이 달라진다.
> 실제로 재봤다 — `1.0.0` → `0.2.0` 으로 바꾸자 지문이 `98c26156…` 에서 `ae5fdb10…` 으로 바뀌었다.
> 그러면 버그픽스마다 OTA 가 끊겨서, OTA 를 붙인 이유가 사라진다.

---

## 폰에 설치해서 써보기

두 가지 길이 있다. **매일 쓰기엔 Expo Go 쪽이 낫다** — 코드를 고치면 즉시 반영되고, 재빌드가 없다.

### 1. Expo Go (실시간, 준비 없음)

폰에 Expo Go 를 설치하고 PC 와 같은 Wi-Fi 에 둔 뒤, **Enter URL manually** 에 개발 서버 주소를 넣는다.

```
exp://<PC의 LAN IP>:8081        예: exp://192.168.0.10:8081
```

서버 주소는 앱이 개발 서버 호스트에서 자동으로 유추한다(`src/shared/api/client.ts`). 따로 설정할 게 없다.
서버는 `HOST=0.0.0.0`(기본값)이어야 하고, 윈도우 방화벽에서 node.exe 인바운드가 허용돼 있어야 한다.

### 2. EAS Build APK (설치형)

```bash
cd mobile
eas login                                          # 최초 1회
eas build --platform android --profile preview     # 클라우드 빌드 → APK 링크
```

**독립 빌드에는 Expo 개발 서버가 없어서 호스트 자동 유추가 동작하지 않는다.** 그래서
`eas.json` 의 `env.EXPO_PUBLIC_API_URL` 에 서버 주소를 박아둔다 — 지금은 운영 주소다.

```json
"EXPO_PUBLIC_API_URL": "https://dalsalim-production.up.railway.app"
```

⚠️ **이 값은 빌드 시점에 박힌다.** 주소가 바뀌면 `eas.json` 을 고치고 **다시 구워야** 한다.
앱을 다시 설치해야 반영된다는 뜻이다.

⚠️ **주소를 바꾸면 EAS 서버 환경변수도 같이 고친다** (`eas env:set`, 아래 「고친 것을 가족에게
보내기」 참조). `eas.json` 만 고치면 그다음 OTA 가 **옛 주소가 실린 번들**을 내보낸다 — 빌드 초록 ·
발행 성공 · 앱 켜짐 · 서버 호출만 죽는다 (시행착오 1-9).

운영 주소를 쓰기 때문에 예전의 LAN 제약이 전부 사라졌다 — PC 를 켜둘 필요도, 공유기가 IP 를
바꿀 걱정도 없다. `usesCleartextTraffic` 예외도 같이 지웠다. 서버가 https 라 평문 HTTP 를
허용할 이유가 없다 (`docs/02-MVP-출시-체크리스트.md` 3장).

> 로컬 서버를 보게 하려면 `eas.json` 의 값을 `http://<LAN-IP>:4000` 으로 바꾸고
> `app.json` 에 `usesCleartextTraffic` 을 되살려야 한다. 안드로이드 9+ 가 평문을 막는다.
> **`expo-build-properties` 패키지는 일부러 남겨뒀으니** `app.json` 의 플러그인 항목만 되살리면 된다.
> **다만 평소 개발은 Expo Go 로 한다** — 그쪽은 이 설정과 무관하고 재빌드도 없다.

---

### 3. 고친 것을 가족에게 보내기 (OTA)

APK 를 다시 굽고 다시 설치하게 하지 않아도 된다. **JS·화면 변경은 이걸로 나간다.**

**GitHub 의 [Actions → OTA 발행 → Run workflow] 버튼을 쓴다.** 채널과 메시지를 넣고 누르면 된다.
로컬에 `eas` CLI 도 로그인도 필요 없고, 발행 전에 네이티브 가드가 한 번 걸러준다.

```bash
# 로컬에서 직접 쏘려면 (버튼과 같은 것을 한다)
cd mobile
eas update --branch preview --message "이번 달 홈 여백 조정"
```

앱을 껐다 켜면 반영된다. 2 분쯤 걸린다.

⚠️ **머지하면 자동으로 나가지 않는다. 일부러 그렇게 뒀다.** CI 가 보는 것은 1층·2층뿐이고
화면은 사람이 눌러봐야 안다(`.claude/rules/testing.md`). 자동 발행은 정확히 그 층만 건너뛴다.
게다가 잘못 나간 번들은 **다음에 앱을 켤 때** 고쳐지므로, 그때까지 가족은 깨진 화면을 본다.
**에뮬레이터에서 한 바퀴 돌린 뒤에 누른다.**

> **워크플로가 막아주는 것** — 지난 발행 뒤에 `mobile/app.json` 의 네이티브 설정이나
> `mobile/package.json` 의 의존성이 바뀌었으면 발행을 멈춘다. 그건 재빌드가 필요한 변경이라
> OTA 로 내보내면 앱이 죽는데, 발행 자체는 초록으로 성공해서 사람은 알아채지 못한다.
>
> **두 곳을 다 보는 게 중요하다.** config plugin 이 필요 없는 네이티브 모듈은
> `expo install` 로 넣어도 `app.json` 이 그대로다 — `app.json` 만 보면 그 길이 열려 있다.
> 순수 JS 라이브러리만 늘었다면 `force` 로 지나간다. 무엇이 바뀌었는지 이름까지 찍어준다.
>
> 무엇을 막고 무엇을 놓아주는지는 `tests/tools/ota-native-guard.test.mjs` 가 지킨다.
> 발행 지점은 `ota-<채널>` 태그로 남는다 — 다음 실행의 비교 기준이자 "언제 뭐가 나갔나" 의 기록이다.
>
> ⚠️ **비교할 태그가 없으면 가드가 안 돈다.** 그러니 **첫 발행 전에 태그를 심어둔다** —
> 기준은 *지금 가족 폰에 깔린 APK 를 구운 커밋* 이다. 안 그러면 하필 새 경로의 시험 발사가
> 가드 없이 나간다.
>
> ```bash
> git tag ota-preview <가족 APK 를 구운 커밋>   # 모르겠으면 그 APK 를 굽던 무렵의 main
> git push origin ota-preview
> ```

⚠️ **`eas.json` 의 `env` 는 `eas update` 에 안 실린다.** 빌드용과 업데이트용 저장소가 다르다.

| | 어디서 읽나 |
|---|---|
| `eas build` | `eas.json` 의 `build.<프로필>.env` |
| `eas update` | **EAS 서버에 등록된 환경변수** |

등록은 한 번만 하면 된다.

```bash
eas env:set --name EXPO_PUBLIC_API_URL --value https://dalsalim-production.up.railway.app \
  --visibility plaintext --environment preview --environment production
```

발행할 때마다 로그에 이 줄이 보이는지 확인한다.

```
Environment variables ... loaded from the "preview" environment on EAS: EXPO_PUBLIC_API_URL.
```

`No environment variables ... found` 로 나오면 **주소가 빠진 번들이 나간다.**
앱은 켜지지만 모든 화면이 "서버에 닿지 못했어요" 가 된다 (시행착오 1-9).

**네이티브가 바뀌면 여전히 재빌드다.** 아래 중 하나라도 건드리면 `eas build` 를 다시 돌리고
가족이 다시 설치해야 한다.

- 새 네이티브 모듈 추가 (`expo install` 로 들어오는 것 대부분)
- `app.json` 의 네이티브 설정 — 아이콘 · 스플래시 · 패키지명 · 플러그인
- `eas.json` 의 `env` (빌드 시점에 박히므로 OTA 로 못 바꾼다)

화면·로직·문구 수정은 전부 OTA 로 간다. 앞으로 할 일의 대부분이 여기 속한다.

> **OTA 가 이어지는 기준은 `runtimeVersion` 이다** — `version` 이 아니다.
> 위 「버전 정책」을 보고, 네이티브를 건드렸을 때만 그 값을 올린다.

---

## 배포 (Railway)

서버와 Postgres 를 **한 프로젝트에** 둔다. 대시보드가 하나고, 내부 네트워크로 붙고,
`DATABASE_URL` 이 자동으로 주입된다.

### 1. 프로젝트 만들기

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → 이 저장소
2. 서비스 카드 클릭 → **Settings → Source → Root Directory** 를 **`server`** 로 지정
   (프로젝트 Settings 가 아니라 **서비스**의 Settings 다. 모노레포라 이걸 안 하면
   루트 `package.json` 에는 `start` 스크립트가 없어서 **No start command detected** 로 죽는다)
3. 같은 Settings 에서 **Config File 경로**를 **`/server/railway.json`** 으로 지정한다.
   ⚠️ **Railway 의 config 파일은 Root Directory 를 따라가지 않는다.** 절대 경로로 적어야 읽는다
4. 같은 프로젝트에서 **New → Database → Add PostgreSQL**

config 파일을 못 읽어도 앱은 뜬다 — `prisma generate` 는 `postinstall` 에도 걸려 있고
마이그레이션은 `start` 가 직접 돌린다. `railway.json` 이 주는 것은 헬스체크와 재시작 정책이다.

### 2. 환경변수 (서비스 → Variables)

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — Postgres 서비스를 참조한다 |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `openssl rand -base64 32` 로 만든 값. **기본값이면 서버가 안 뜬다** |
| `PUBLIC_BASE_URL` | 배포된 공개 주소 (`https://...up.railway.app`) |
| `KAKAO_REST_API_KEY` | 카카오 개발자 콘솔 값 |
| `KAKAO_CLIENT_SECRET` | 쓰는 경우에만 |

**`PORT` 는 직접 넣는다** — 도메인의 target port 와 같은 값이어야 한다.
앱은 `process.env.PORT` 를 그대로 쓰므로 둘이 다르면 4절의 502 가 난다.
**`DEV_LOGIN` 은 넣지 않는다** —
기본값이 꺼짐이고, 운영에서는 아예 켤 수 없다.

### 3. 확인할 것

- [ ] `GET /health` 가 `{"ok":true,"devLogin":false}` 를 준다 — **`devLogin` 이 false 인지 꼭 본다**
- [ ] `POST /auth/dev` 가 **404** 다 (라우트가 등록조차 되지 않아야 한다)
- [ ] 첫 배포 로그에 `prisma migrate deploy` 가 마이그레이션을 적용한 게 보인다
- [ ] 앱의 `EXPO_PUBLIC_API_URL` 을 이 주소로 — **두 곳이다.**
      `mobile/eas.json`(빌드용) + `eas env:set`(OTA 용). 한쪽만 고치면 시행착오 1-9 가 재발한다.
      그다음 APK 를 다시 굽는다
- [ ] 🔴 **자동 백업이 켜져 있는지 확인하고, 복구를 한 번 실제로 해본다.**
      가계부는 날아가면 복구가 불가능한 데이터다. 백업이 부실하면 DB 만
      Supabase 나 Neon 으로 빼는 것을 검토한다 (`DATABASE_URL` 만 바꾸면 된다)

### 4. 처음 올릴 때 실제로 걸린 것 (2026-09-07)

세 번 막혔고 셋 다 문서에 없던 것이라 적어둔다. 배포는 자주 안 하므로 다음에도 잊는다.

| 증상 | 원인 | 고침 |
|---|---|---|
| `No start command detected` | Root Directory 가 안 먹어 **루트에서 빌드**했다. 루트 `package.json` 에는 `start` 가 없다 | 서비스 Settings → Source → Root Directory = `server`. 저장 후 값이 남았는지 다시 본다 |
| `Environment variable not found: DATABASE_URL` | 참조 문자열을 손으로 적었는데 **Postgres 서비스 이름이 달랐다** | Variables 의 참조 버튼으로 드롭다운에서 고른다. 타이핑하지 않는다 |
| `502 Application failed to respond` | 도메인이 보내는 포트와 앱이 듣는 포트가 달랐다 | `PORT` 변수를 도메인의 target port 와 같게 맞춘다. 앱은 `process.env.PORT` 를 그대로 쓴다 |

⚠️ **Railway 의 config 파일은 Root Directory 를 따라가지 않는다.** `server/railway.json` 을 읽히려면
Settings 에 절대 경로(`/server/railway.json`)를 지정해야 한다. 안 읽혀도 앱은 뜬다 —
`prisma generate` 는 `postinstall` 에, 마이그레이션은 `start` 에 걸어뒀다.
`railway.json` 이 주는 것은 헬스체크와 재시작 정책뿐이다.

### 왜 이렇게 했나

- **`start` 가 `prisma migrate deploy && tsx src/index.ts` 다.** 마이그레이션을 먼저 적용하고
  서버를 띄운다 — 순서가 바뀌면 새 컬럼을 모르는 채로 서버가 뜬다
- **`prisma` 와 `tsx` 가 `dependencies` 에 있다.** `NODE_ENV=production` 이면 npm 이
  `devDependencies` 를 건너뛰는데, 그러면 위 `start` 가 통째로 깨진다
- **유휴 슬립이 없는 플랜이어야 한다.** 이 앱은 한 달에 한 번 열려서
  **항상 잠든 상태에서 시작**한다. 콜드 스타트를 매번 정면으로 맞는다

