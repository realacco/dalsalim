/**
 * 에러 코드 → 상태코드 · 메시지 사전. 서버가 사용자에게 보내는 실패 문장은 전부 여기 있다.
 *
 * `code` 는 앱과 스모크가 분기하는 **계약**이다. 라우트에서 문자열을 새로 만들지 않는다 —
 * 여기 없는 코드는 없는 것이다. 앱이 어떤 에러가 올 수 있는지 알 방법이 이 파일뿐이다.
 *
 * `message` 는 화면에 그대로 뜬다 (CLAUDE.md 말투 규칙)
 *   - 해요체. `~습니다` 는 쓰지 않는다 — 앱 쪽 문구가 해요체라 한 화면 안에서 말투가 튄다
 *   - 사용자를 탓하지 않는다. 상황을 말하고 끝낸다
 *   - 무엇을 하면 되는지 말한다. 막힌 이유가 곧 다음 행동이다
 *
 * 같은 코드에 상황 설명이 붙어야 하면(어느 항목이 비었는지) message 를 함수로 둔다.
 * 순수 모듈이다 — prisma · fastify 를 임포트하지 않는다 (lib/shared 와 같은 급).
 */

type ErrorEntry = {
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500;
  message: string | ((detail?: string) => string);
};

export const ERRORS = {
  // ── 세션 ─────────────────────────────────────────────────────────────
  UNAUTHORIZED: { status: 401, message: '로그인이 필요해요.' },
  TOKEN_INVALID: { status: 401, message: '로그인이 만료됐어요. 다시 로그인해주세요.' },
  USER_GONE: { status: 401, message: '계정을 찾을 수 없어요. 다시 로그인해주세요.' },
  DEV_LOGIN_DISABLED: { status: 401, message: '개발용 로그인이 꺼져 있어요.' },
  BAD_STATE: { status: 400, message: '로그인 요청이 올바르지 않아요. 처음부터 다시 시도해주세요.' },
  KAKAO_NOT_CONFIGURED: {
    status: 400,
    message: '서버에 카카오 키가 없어요. 개발용 로그인을 써주세요.',
  },
  KAKAO_TOKEN_FAILED: { status: 401, message: '카카오 로그인이 안 됐어요. 다시 시도해주세요.' },
  KAKAO_PROFILE_FAILED: {
    status: 401,
    message: '카카오 프로필을 못 가져왔어요. 다시 시도해주세요.',
  },

  // ── 가족 · 구성원 ─────────────────────────────────────────────────────
  PENDING_APPROVAL: { status: 403, message: '가족장이 승인해야 들어갈 수 있어요.' },
  NOT_MEMBER: { status: 403, message: '이 가족의 구성원이 아니에요.' },
  OWNER_ONLY: { status: 403, message: '가족장만 할 수 있어요.' },
  OWNER_ONLY_REMOVE: { status: 403, message: '가족장만 구성원을 내보낼 수 있어요.' },
  INVITE_CODE_NOT_FOUND: {
    status: 404,
    message: '이 초대코드로 찾은 가족이 없어요. 코드를 다시 확인해주세요.',
  },
  ALREADY_MEMBER: { status: 409, message: '이미 참여한 가족이에요.' },
  ALREADY_REQUESTED: {
    status: 409,
    message: '이미 참여를 요청했어요. 가족장의 승인을 기다려주세요.',
  },
  REQUEST_NOT_FOUND: {
    status: 404,
    message: '그 참여 요청을 찾을 수 없어요. 이미 처리됐을 수 있어요.',
  },
  MEMBER_NOT_FOUND: { status: 404, message: '그 구성원을 찾을 수 없어요.' },
  ALREADY_OWNER: { status: 400, message: '이미 가족장이에요.' },
  TRANSFER_OWNER_FIRST: {
    status: 400,
    message: '가족장을 다른 구성원에게 넘긴 뒤에 나갈 수 있어요.',
  },
  BAD_MEMBERSHIP: { status: 400, message: '이 가족의 구성원이 아니에요.' },

  // ── 고정비 ───────────────────────────────────────────────────────────
  FIXED_EXPENSE_NOT_FOUND: { status: 404, message: '고정비 항목을 찾을 수 없어요.' },

  // ── 장부 · 기록 ───────────────────────────────────────────────────────
  BAD_YEAR_MONTH: { status: 400, message: '달은 2026-09 처럼 적어주세요.' },
  FUTURE_MONTH: { status: 400, message: '아직 오지 않은 달이에요.' },
  ENTRY_NOT_FOUND: { status: 404, message: '기록을 찾을 수 없어요.' },
  NOT_MY_ENTRY: { status: 403, message: '내 기록만 고칠 수 있어요.' },
  ENTRY_SUBMITTED: {
    status: 403,
    message: '제출한 기록이에요. [수정하기]를 눌러 다시 열어주세요.',
  },
  LINE_NOT_FOUND: { status: 404, message: '입력 줄을 찾을 수 없어요.' },
  NOT_DELETABLE: { status: 400, message: '추가 지출 항목만 지울 수 있어요.' },
  /** ★ 하드룰 2·3 — 줄 저장에서는 항목 없이, 제출에서는 비어 있는 항목 이름을 붙여서 */
  REASON_REQUIRED: {
    status: 400,
    message: (names?: string) =>
      names
        ? `사유가 비어 있어요: ${names}`
        : '금액이 달라졌어요. 이번 달에 왜 이랬는지 한 줄만 적어주세요.',
  },
  INCOMPLETE: {
    status: 400,
    message: (names?: string) => `아직 적지 않은 항목이 있어요${names ? `: ${names}` : '.'}`,
  },

  // ── 전역 ─────────────────────────────────────────────────────────────
  VALIDATION: { status: 400, message: '입력값을 확인해주세요.' },
  RATE_LIMITED: { status: 429, message: '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' },
  INTERNAL: { status: 500, message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.' },
} satisfies Record<string, ErrorEntry>;

export type ErrorCode = keyof typeof ERRORS;

/** 코드에 맞는 문장. detail 은 함수형 메시지에만 쓰인다 */
export function messageFor(code: ErrorCode, detail?: string): string {
  const entry: ErrorEntry = ERRORS[code];
  return typeof entry.message === 'function' ? entry.message(detail) : entry.message;
}

export function statusFor(code: ErrorCode): number {
  return ERRORS[code].status;
}
