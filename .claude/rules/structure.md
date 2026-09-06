# 폴더 구조

> **언제 읽나:** 파일을 새로 만들거나 옮길 때 · 어디에 둘지 헷갈릴 때.
핵심 한 줄은 CLAUDE.md 에 남겨두었다 — 임포트는 위에서 아래로만.

### 서버 — 레이어드 (도메인 슬라이스로 쪼개지 않는다)

```
server/src/
  index.ts        부팅 — 플러그인 · 전역 에러 핸들러 · 라우트 등록. 로직 없음
  env.ts          환경변수 파싱 (여기가 유일한 process.env 접근 지점)
  routes/         HTTP 경계 — zod 검증 · 권한 확인 · 응답 조립. prisma 를 직접 부르지 않는다
  services/       도메인 로직 — family · fixed-expense · book · entry. prisma 는 여기서만
  lib/            기반 — db(prisma) · auth(가드) · http(에러) · messages(코드→문장 사전) ·
                  schemas(라우트 공용 zod 조각) · shared(상수·순수함수)
```

- **임포트 방향은 위에서 아래로만**: `routes → services → lib`.
  services가 routes를 임포트하거나, **라우트끼리 서로 임포트하는 것 금지.**
- **`services/` 끼리 서로 임포트하는 것은 한 방향만.** 지금은 `entry → book`(제출하면 완성 판정을
  다시 한다) · `family → book`(구성원이 바뀌면 정원이 바뀐다) 둘뿐이고 `book` 은 아무도 안 부른다.
  **원이 생기면 둘 다가 쓰는 조각을 `lib/`로 내린다** — 서로 임포트하는 두 파일은 어느 쪽이 더 아래인지
  말할 수 없고, 나중에 누가 파일 맨 위에서 상대 함수를 쓰는 순간 "함수가 아니다"로 터진다.
- **`lib/shared.ts`·`lib/messages.ts`는 순수해야 한다.** prisma·fastify를 임포트하지 않는다.
  실패는 `throw fail('CODE')` 한 가지 방법으로만 만든다 — 코드와 문장은 `messages.ts` 에만 있다.
  앱의 `entities/*/model`과 짝을 이루는 계약(카테고리 목록, `needsReason`, `yearMonth` 계산)이 여기 산다.
- **`process.env`는 `env.ts`에서만 읽는다.** 다른 파일에서 직접 읽지 않는다.
- **앱처럼 FSD로 쪼개지 않는다.** 도메인이 5개(session·family·fixed-expense·book·entry)로 고정이고
  `routes/`·`services/`가 이미 그 축으로 갈려 있다. 여기서 또 슬라이스를 파면
  파일 하나짜리 폴더만 늘어난다. **앱은 화면이 계속 늘지만 서버는 안 는다** — 그 차이가 구조를 가른다.

**라우트 파일은 도메인당 하나가 기본이되, "가족 문 앞"처럼 뚜렷이 다른 무대는 따로 둔다**
(`families.ts` 가족 안 · `join-requests.ts` 참여 요청). 라우트끼리 공유할 zod 조각은 `lib/schemas.ts` 에 둔다 —
라우트끼리는 서로 임포트할 수 없다.

**라우트가 두꺼워지는 신호** (= services로 내릴 때다)

- 같은 계산을 두 라우트가 한다 → 그 순간 `services/`로 뺀다 (요약과 추이의 집계가 이 경우다)
- 라우트 핸들러 하나가 40줄을 넘는다
- 라우트 안에서 `prisma`를 세 번 이상 부른다 — 트랜잭션 경계가 흐려진 신호다

### 앱 — FSD (Feature-Sliced Design)

```
mobile/src/
  app/          expo-router 라우트 전용 — 얇게. screens를 re-export만 한다
  screens/      화면 단위 (FSD pages 레이어. 기획서 7장의 화면과 1:1)
  widgets/      화면 조각 (여러 feature 조합)
  features/     사용자 행동 단위 기능
  entities/     도메인 모델 (book, entry, fixed-expense, family, session)
  shared/       전역 공용 — ui / config(theme) / lib / api
```

- **임포트 방향은 위에서 아래로만**: `app → screens → widgets → features → entities → shared`.
  아래 레이어가 위 레이어를 임포트하거나, **같은 레이어끼리 서로 임포트하는 것 금지.**
- **`src/app/`은 라우팅만 한다.** 화면 구현을 여기 두지 않는다. 파일 하나에 `export { default } from '...'` 수준.
  (expo-router는 `src/app/`을 라우트 루트로 인식한다)
- **슬라이스 내부는 `ui/ model/ api/ lib/`로 나눈다.** 파일이 하나뿐일 땐 단독 파일도 허용하되,
  두 번째 관심사가 생기는 순간 폴더로 쪼갠다.
- **화면 슬라이스는 `index.tsx`(배치) + `model/`(상태·규칙) + `ui/`(조각)이 기본형이다.**
  `index.tsx` 는 훅에서 받은 것을 배치만 한다. 지금 이 모양인 화면: `family` · `this-month` ·
  `fixed-expenses` · `wizard`. 화면이 작으면(`gate` `trend` `login` …) 단독 파일로 둔다.

  | 종류 | 위치 | 규칙 |
  |---|---|---|
  | 화면 상태 조립 | 슬라이스의 `model/use-*.ts` | React 훅. 화면 하나에 훅 하나가 기본 |
  | 도메인 규칙·계산 | `entities/<domain>/model/*.ts` | **순수 함수. react·react-native 임포트 금지** |
  | 서버 통신 | `entities/<domain>/api/*.ts` | 화면에서 `api()` 직접 호출 금지. 쿼리 키도 여기서 관리 |
  | 범용 유틸 | `shared/lib` | 도메인 지식이 없는 것만. 섞이면 entities로 |

- **빈 레이어(widgets/features)는 필요해질 때 만든다.** 미리 만들지 않는다.
- 서버 응답 타입은 그 도메인의 `entities/<domain>/model/types.ts`에 둔다. 한 파일에 전부 모아두지 않는다.
  여러 도메인이 함께 쓰는 조각은 `shared/model/types.ts`로 — entities끼리는 임포트할 수 없다.


