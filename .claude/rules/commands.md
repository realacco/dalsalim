# 명령어

> **언제 읽나:** 서버·앱을 띄우거나 DB 를 만질 때. 처음 세팅은 `README.md` 를 본다.

```bash
# 저장소 루트 (커밋 훅 · 포매터)
npm install                    # husky 훅 설치까지 같이 된다. 클론하면 여기부터
npm test                       # 1층 테스트 (server · mobile · contract · tools)
npm run lint                   # server + mobile 전체
npm run typecheck              # tests + server + mobile 전체
npm run format                 # prettier --write .

# 서버
cd server
npm run dev              # tsx watch — 코드 고치면 자동 재시작 (localhost:4000)
npm run typecheck
node scripts/smoke.mjs   # 전 구간 검증 (자기 가족 '스모크네'를 직접 만들어 쓴다)
npm run seed             # 데모 가족 '김씨네'
npm run db:studio        # Prisma Studio

# 앱
cd mobile
npm run dev -- --android # 에뮬레이터 부팅 + adb reverse + Metro
npm run typecheck
```

- 옵션: `--no-emu`(에뮬레이터 자동 실행 끄기) · `--clear`(Metro 캐시 초기화)
- ⚠️ **네이티브 빌드를 하지 않는다.** 카카오를 REST OAuth로 붙였기 때문에 `expo prebuild`도,
  `android/` 폴더도 없다. 네이티브 모듈이 필요한 라이브러리를 들이기 전에 먼저 상의한다 —
  Expo Go로 바로 도는 지금의 개발 루프를 잃는 결정이다.
- adb 먹통 · 에뮬레이터 프레임버퍼 정지 · 한글 입력 불가 등 함정은 `README.md` 개발 노트에 정리돼 있다.

