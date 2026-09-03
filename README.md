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

📄 **[MVP 기획서](docs/01-MVP-기획서.md)** · **[MVP 출시 체크리스트](docs/02-MVP-출시-체크리스트.md)**

> 지금은 **MVP 단계**다. 빠르게 만들어 몇 달 써보고 방향을 잡는 게 목적이다.

---

## 빠르게 실행하기

터미널 두 개가 필요하다.

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
│   ├── 01-MVP-기획서.md            무엇을 왜 만드는가 · 화면 · 데이터모델 · API
│   └── 02-MVP-출시-체크리스트.md    실제로 쓰기 시작하기까지 남은 일
│
├── server/                   Fastify + Prisma + Postgres · 레이어드
│   ├── prisma/schema.prisma    데이터 모델 (원본)
│   ├── prisma/migrations/      마이그레이션 (커밋 대상)
│   ├── src/routes/             auth · families · fixedExpenses · books · entries
│   ├── src/services/           entry(프리필) · book(완성 판정·집계) · family(초대코드)
│   ├── src/lib/                db · auth(가드) · http(에러) · shared(상수·순수함수)
│   └── scripts/smoke.mjs       전 구간 스모크 테스트 38개
│
└── mobile/                   Expo (React Native) + expo-router · FSD
    ├── src/app/                expo-router 라우트 — screens 를 re-export 만 한다
    ├── src/screens/            gate · login · onboarding · this-month ·
    │                           fixed-expenses · family · wizard · month-summary
    ├── src/entities/           session · family · fixed-expense · book · entry
    │                           (도메인별 api + model)
    ├── src/shared/             ui · config(theme) · lib(format) · api(client) · model(types)
    └── scripts/                dev.js · emulator.js
```

## 검증

```bash
cd server && node scripts/smoke.mjs   # API 38개 — 로그인부터 요약까지
cd server && npm run typecheck
cd mobile && npm run typecheck
```

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

지금은 개발용 로그인만 켜져 있다. 실제 카카오 로그인을 쓰려면:

1. [카카오 개발자 콘솔](https://developers.kakao.com)에서 앱 생성
2. **앱 키 > REST API 키**를 `server/.env`의 `KAKAO_REST_API_KEY`에 넣는다
3. **카카오 로그인 > Redirect URI**에 `http://localhost:4000/auth/kakao/callback` 등록
4. **동의항목**에서 닉네임(profile_nickname)을 켠다
5. 서버 재시작 → 로그인 화면의 카카오 버튼이 활성화된다

> 실기기나 외부에서 붙일 때는 `PUBLIC_BASE_URL`을 그 주소로 바꾸고 콘솔의 Redirect URI도 같이 바꾼다.

---

## 폰에 설치해서 써보기

두 가지 길이 있다. **매일 쓰기엔 Expo Go 쪽이 낫다** — 코드를 고치면 즉시 반영되고, 재빌드가 없다.

### 1. Expo Go (실시간, 준비 없음)

폰에 Expo Go 를 설치하고 PC 와 같은 Wi-Fi 에 둔 뒤, **Enter URL manually** 에 개발 서버 주소를 넣는다.

```
exp://<PC의 LAN IP>:8081        예: exp://192.168.45.56:8081
```

서버 주소는 앱이 개발 서버 호스트에서 자동으로 유추한다(`src/shared/api/client.ts`). 따로 설정할 게 없다.
서버는 `HOST=0.0.0.0`(기본값)이어야 하고, 윈도우 방화벽에서 node.exe 인바운드가 허용돼 있어야 한다.

### 2. EAS Build APK (설치형)

```bash
cd mobile
eas login                                          # 최초 1회
eas build --platform android --profile preview     # 클라우드 빌드 → APK 링크
```

**독립 빌드에는 Expo 개발 서버가 없어서 호스트 자동 유추가 동작하지 않는다.** 그래서 `eas.json` 의
`preview.env.EXPO_PUBLIC_API_URL` 에 서버 주소를 박아둔다. 지금은 이 PC 의 LAN 주소라서:

- **PC 가 켜져 있고 서버가 떠 있어야** 앱이 동작한다
- **공유기가 PC 에 다른 IP 를 주면 깨진다.** `eas.json` 의 값을 고치고 다시 빌드해야 한다
  (자주 겪는다면 공유기에서 이 PC 의 IP 를 고정해두는 편이 낫다)
- 안드로이드 9+ 는 평문 HTTP 를 막기 때문에 `app.json` 에서 `usesCleartextTraffic` 을 켜뒀다.
  **서버를 https 로 배포하면 이 예외는 지운다** (`docs/02-MVP-출시-체크리스트.md` 3장)

---

## 배포 (Railway)

서버와 Postgres 를 **한 프로젝트에** 둔다. 대시보드가 하나고, 내부 네트워크로 붙고,
`DATABASE_URL` 이 자동으로 주입된다.

### 1. 프로젝트 만들기

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → 이 저장소
2. 생성된 서비스 → **Settings → Root Directory** 를 **`server`** 로 지정
   (모노레포라 이걸 안 하면 루트에서 빌드하려다 실패한다)
3. 같은 프로젝트에서 **New → Database → Add PostgreSQL**

빌드·시작 명령과 헬스체크는 `server/railway.json` 에 들어 있어서 따로 설정할 게 없다.

### 2. 환경변수 (서비스 → Variables)

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` — Postgres 서비스를 참조한다 |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | `openssl rand -base64 32` 로 만든 값. **기본값이면 서버가 안 뜬다** |
| `PUBLIC_BASE_URL` | 배포된 공개 주소 (`https://...up.railway.app`) |
| `KAKAO_REST_API_KEY` | 카카오 개발자 콘솔 값 |
| `KAKAO_CLIENT_SECRET` | 쓰는 경우에만 |

`PORT` 는 Railway 가 알아서 넣어준다. **`DEV_LOGIN` 은 넣지 않는다** —
기본값이 꺼짐이고, 운영에서는 아예 켤 수 없다.

### 3. 확인할 것

- [ ] `GET /health` 가 `{"ok":true,"devLogin":false}` 를 준다 — **`devLogin` 이 false 인지 꼭 본다**
- [ ] `POST /auth/dev` 가 **404** 다 (라우트가 등록조차 되지 않아야 한다)
- [ ] 첫 배포 로그에 `prisma migrate deploy` 가 마이그레이션을 적용한 게 보인다
- [ ] 앱의 `EXPO_PUBLIC_API_URL` 을 이 주소로 바꾸고 APK 를 다시 굽는다
- [ ] 🔴 **자동 백업이 켜져 있는지 확인하고, 복구를 한 번 실제로 해본다.**
      가계부는 날아가면 복구가 불가능한 데이터다. 백업이 부실하면 DB 만
      Supabase 나 Neon 으로 빼는 것을 검토한다 (`DATABASE_URL` 만 바꾸면 된다)

### 왜 이렇게 했나

- **`start` 가 `prisma migrate deploy && tsx src/index.ts` 다.** 마이그레이션을 먼저 적용하고
  서버를 띄운다 — 순서가 바뀌면 새 컬럼을 모르는 채로 서버가 뜬다
- **`prisma` 와 `tsx` 가 `dependencies` 에 있다.** `NODE_ENV=production` 이면 npm 이
  `devDependencies` 를 건너뛰는데, 그러면 위 `start` 가 통째로 깨진다
- **유휴 슬립이 없는 플랜이어야 한다.** 이 앱은 한 달에 한 번 열려서
  **항상 잠든 상태에서 시작**한다. 콜드 스타트를 매번 정면으로 맞는다

---

## 개발 노트 (이 PC 기준 · 함정 모음)

| 항목 | 값 |
|---|---|
| Node | v24.19.0 |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk` (platform 34·35·36) |
| JDK 17 | `C:\Users\asdfg\.jdks\jdk-17.0.20+8` — **AVD 만들 때만** 필요 |
| Android Studio | 미설치 — SDK + JDK만으로 충분 |
| AVD | `dalsalim` — Pixel 6 / Android 15 / Play 이미지 (x86_64) |

전역 `JAVA_HOME`이 JDK 8이어도 된다. **달살림은 네이티브 빌드를 하지 않는다** (카카오를 REST로 붙였으므로).

### ⚠️ adb를 많이 부르면 adb 서버가 먹통이 된다

`adb shell ...`을 수십 번 연달아 부르면 클라이언트 프로세스가 쌓여서 `adb devices`가 멈추고,
`scripts/dev.js`도 거기서 블로킹된다. **`adb devices`가 몇 초 안에 안 끝나면 이거다.**

```powershell
Get-Process adb | Stop-Process -Force    # 에뮬레이터는 안 죽는다
```
```bash
adb start-server && adb wait-for-device && adb devices
```

### ⚠️ 에뮬레이터 GPU 모드가 `auto`면 화면이 얼어붙는다

앱은 정상 동작하는데(logcat은 흐른다) **화면과 `adb screencap`만 몇 분 전 프레임을 반환한다.**
상태바 시계가 `adb shell date`보다 뒤처져 있으면 이것이다.
→ `-gpu swiftshader_indirect`로 띄운다. `scripts/emulator.js`는 이미 이 옵션이 박혀 있다.

### ⚠️ `adb shell input text`는 한글을 못 넣는다

에뮬레이터 자동 시나리오는 영문 이름으로 돌리고, 한글이 들어간 흐름은
`server/scripts/smoke.mjs`(API 레벨)로 검증하는 편이 빠르다.

### 자주 쓰는 명령

```bash
adb exec-out screencap -p > shot.png                 # 화면 캡처
adb shell input tap <x> <y>                          # 탭
adb logcat -s ReactNativeJS                          # JS 로그

# Expo Go 재시작 (라우터 구조 변경 등 Fast Refresh로 안 잡히는 것)
adb shell am force-stop host.exp.exponent
adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent
```

### 포트가 안 놓일 때 / DB 초기화

```powershell
foreach ($p in 4000,8081) {   # 4000=API, 8081=Metro
  Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force }
}
```
```bash
cd server && npm run db:reset && npm run seed   # 서버를 먼저 끄고
```

DB 를 갈아엎기 전에 내용을 지키고 싶으면:

```bash
cd server
npm run db:export             # -> data-export.json (gitignore 되어 있다)
npm run db:reset
npm run db:import             # 되돌리기
```

### AVD를 다시 만들어야 할 때

```bash
export JAVA_HOME="C:/Users/asdfg/.jdks/jdk-17.0.20+8"
"$LOCALAPPDATA/Android/Sdk/cmdline-tools/latest/bin/avdmanager.bat" create avd \
  -n dalsalim -k "system-images;android-35;google_apis_playstore;x86_64" -d pixel_6
```

만든 뒤 `~/.android/avd/dalsalim.avd/config.ini`에서 고친다 (avdmanager 기본값은 그대로 쓰기 곤란하다):
`PlayStore.enabled=yes` · `hw.gpu.enabled=yes` · `hw.gpu.mode=swiftshader_indirect` ·
`hw.ramSize=4096` · `vm.heapSize=512` · `hw.keyboard=yes` · `disk.dataPartition.path` 줄은 삭제.
