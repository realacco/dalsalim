/**
 * 커밋 메시지 규칙 — CLAUDE.md 「커밋 규칙」의 기계 판정본이다.
 * 문서와 이 파일이 어긋나면 **CLAUDE.md 가 맞다.** 여기를 고치기 전에 문서를 먼저 고친다.
 *
 * 여기서 검사하지 않는 것: 체언 종결(`~ 추가`) · 본문의 "왜".
 * 기계가 판정할 수 없어서 뺐지 규칙이 아니어서 뺀 게 아니다 — 리뷰에서 본다.
 */

/**
 * scope = 변경의 무대.
 *
 * 도메인 5개는 기획서의 기능 ID(F-SES · F-FAM · F-FIX · F-BOOK · F-ENT)와 1:1 이다.
 * 나머지는 "도메인 이름으로는 못 부르는 무대"만 최소로 열어둔다 —
 * scope 가 늘어나면 아무도 고르지 못하고 결국 생략하게 된다.
 */
const SCOPES = [
  // ── 도메인 5 (server/routes·services · mobile/entities 와 같은 축) ──────────
  'session', //       로그인 · 토큰 · 게이트          auth.ts · entities/session
  'family', //        가족 · 초대코드 · 승인 · 구성원  families.ts · entities/family
  'fixed-expense', // 고정비 항목(매달 템플릿이 되는 것) fixedExpenses.ts
  'book', //          월 장부 · 요약 · 추이 · 상태     books.ts · services/book.ts
  'entry', //         기록 · 줄 · 사유 · 제출          entries.ts · services/entry.ts

  // ── 화면 ────────────────────────────────────────────────────────────────
  'wizard', //        입력 위저드. entry 도메인이지만 앱에서 가장 큰 슬라이스라 따로 부른다
  'ui', //            shared/ui 공용 컴포넌트 · shared/config 디자인 토큰

  // ── 무대 (도메인 하나에 안 붙는 전반) ────────────────────────────────────
  'server',
  'mobile',

  // ── 도구 · 인프라 ───────────────────────────────────────────────────────
  'prisma', //        스키마 · 마이그레이션
  'lint', //          eslint · prettier · husky · commitlint
  'ci', //            GitHub Actions
  'deploy', //        Railway · EAS
  'deps', //          의존성 추가 · 갱신

  // ── 문서 ────────────────────────────────────────────────────────────────
  'plan', //          기획서 · 출시 체크리스트 · 태스크 문서
];

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // CLAUDE.md 가 정한 8개. 여기 없는 type 은 쓰지 않는다
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'test', 'docs', 'style', 'perf', 'chore'],
    ],
    'scope-enum': [2, 'always', SCOPES],

    // 여러 영역에 걸치면 생략한다 (CLAUDE.md). 생략 자체는 막지 않는다
    'scope-empty': [0],

    // 제목 50자 내외 · 마침표 없음 (CLAUDE.md).
    // header 가 아니라 subject 로 재는 이유: 한글은 한 글자가 1 로 세어져서
    // header 기준 72 를 걸면 한글 제목은 사실상 무제한이 된다
    'subject-max-length': [2, 'always', 56],
    'subject-full-stop': [2, 'never', '.'],
    'subject-empty': [2, 'never'],

    // 한국어라 대소문자 규칙이 의미 없다 — 끈다
    'subject-case': [0],

    // 본문은 한 줄 띄고 시작한다. printWidth 100 과 맞춘다
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],
    'footer-leading-blank': [2, 'always'],
  },
};
