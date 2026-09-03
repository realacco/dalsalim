/** 앱과 서버가 공유하는 상수·타입. 앱 쪽 mobile/src/shared/model/types.ts 와 짝을 이룬다. */

export const CATEGORIES = [
  '주거',
  '통신',
  '보험',
  '교통',
  '구독',
  '교육',
  '대출·상환',
  '생활비',
  '기타',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LINE_KINDS = ['INCOME', 'FIXED', 'EXTRA'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export type EntryStatus = 'DRAFT' | 'SUBMITTED';
export type BookStatus = 'OPEN' | 'COMPLETE';
export type Role = 'OWNER' | 'MEMBER';

/**
 * 멤버십 상태. 초대코드는 카톡으로 오가는 문자열이라 새어나갈 수 있어서,
 * 코드를 맞힌 사람은 곧바로 구성원이 아니라 PENDING(승인 대기)으로 들어온다.
 * 가계부를 볼 수 있는 상태는 ACTIVE 하나뿐이다.
 */
export const MEMBERSHIP_STATUSES = ['PENDING', 'ACTIVE', 'LEFT'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** 구성원으로 세는 조건. 정원·목록·권한이 전부 이 하나를 봐야 어긋나지 않는다. */
export const ACTIVE_MEMBER = { status: 'ACTIVE' } as const;

/** 'YYYY-MM' 형식인지 */
export function isYearMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** 'YYYY-MM' 에서 n개월 이동 */
export function shiftYearMonth(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const zero = y * 12 + (m - 1) + months;
  const year = Math.floor(zero / 12);
  const month = (zero % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** 이번 달 'YYYY-MM'. 앱의 shared/lib/format.ts 에 같은 함수가 있다 — tests/contract 가 둘을 맞춰본다 */
export function currentYearMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 사유가 반드시 필요한가?
 * 기본값이 있고(= 비교 대상이 있고) 실제 금액이 그와 다르면 필수다.
 * 기본값이 없는 첫 달과 추가 지출은 비교 대상이 없으므로 묻지 않는다.
 */
export function needsReason(plannedAmount: number | null, actualAmount: number | null): boolean {
  if (plannedAmount === null || actualAmount === null) return false;
  return plannedAmount !== actualAmount;
}

/** 합계를 내는 데 필요한 최소한의 모양. prisma 타입을 쓰지 않으려고 여기서 다시 적는다 */
export type SummableLine = { kind: string; actualAmount: number | null };

/**
 * 수입 · 고정비 · 추가지출을 더하고 남은 돈을 낸다.
 *
 * 장부(요약 · 추이)와 기록(위저드)이 똑같이 쓰는 계산이라 어느 한쪽에 두면
 * 다른 쪽이 그쪽을 임포트하게 된다. 순수 계산이므로 둘 다의 아래층인 여기가 맞다.
 *
 * 금액이 비어 있는 줄(아직 안 적은 것)은 0 으로 센다. 호출하는 쪽이 제출된 기록만
 * 넘겨야 하는 이유가 이것이다 — 작성 중인 사람의 빈 줄을 넣으면 "수입 0원"이 된다.
 */
export function entrySummary(lines: SummableLine[]) {
  let income = 0;
  let fixedTotal = 0;
  let extraTotal = 0;

  for (const line of lines) {
    const amount = line.actualAmount ?? 0;
    if (line.kind === 'INCOME') income += amount;
    else if (line.kind === 'FIXED') fixedTotal += amount;
    else extraTotal += amount;
  }

  return { income, fixedTotal, extraTotal, surplus: income - fixedTotal - extraTotal };
}

/**
 * 위저드 진행 표시. 총 스텝 = 수입 1 + 고정비 n + 추가지출 1 + 특이사항 1 + 확인 1.
 * cursor 는 0 부터 세는 위치라 사람에게는 +1 로 보여주되, 스텝 수를 넘지 않는다.
 */
export function bookProgress(cursor: number, fixedExpenseCount: number) {
  const total = fixedExpenseCount + 4;
  return { step: Math.min(cursor + 1, total), total };
}

/**
 * 초대코드 규칙.
 *
 * 사람이 카톡으로 불러주거나 눈으로 읽어 옮겨 적는 코드라서, 헷갈리는 글자(0/O, 1/I)를 뺀다.
 * 인프라가 아니라 도메인 규칙이므로 db 가 아니라 여기 있다. 겹치는지 확인은 services 가 한다.
 */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;

export function randomInviteCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[Math.floor(random() * INVITE_CODE_ALPHABET.length)];
  }
  return code;
}
