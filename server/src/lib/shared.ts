// 기능: F-FIX-05 F-FIX-07 F-ENT-03 F-ENT-04 F-ENT-11 F-FAM-03 F-FAM-06 F-BOOK-01 F-FIX-06
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

/**
 * 결산 스위치의 기본값 — 분류가 생활비면 켜진다 (기획서 7.4 · F-FIX-07).
 *
 * 생활비·용돈처럼 "옮겨두고 쓰는 돈"만 다음 달에 실제 쓴 금액을 되묻는다. 분류로 기본값만 정하고
 * 저장한 뒤에는 둘이 독립이다 — 기타에 든 용돈은 직접 켜고, 생활비 분류라도 끌 수 있다.
 * 앱의 entities/fixed-expense/model 에 같은 함수가 있다 — tests/contract 가 둘을 맞춰본다.
 */
export function defaultSettles(category: string): boolean {
  return category === '생활비';
}

/**
 * 줄 종류. SETTLEMENT 는 "지난달에 옮겨둔 돈을 실제로 얼마나 썼나" 를 묻는 결산 줄이다 (F-ENT-11).
 * 이번 달 지출이 아니라 지난달 지출의 정정이라, 합계에서 고정비·추가지출과 다르게 센다.
 */
export const LINE_KINDS = ['SETTLEMENT', 'INCOME', 'FIXED', 'EXTRA'] as const;
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

/** 사유 판정에 필요한 최소한의 모양. 줄 종류가 판정에 들어가므로 금액 둘만으로는 부족하다 */
export type ReasonableLine = {
  kind: string;
  plannedAmount: number | null;
  actualAmount: number | null;
};

/**
 * 사유가 반드시 필요한가?
 * 기본값이 있고(= 비교 대상이 있고) 실제 금액이 그와 다르면 필수다.
 * 기본값이 없는 첫 달과 추가 지출은 비교 대상이 없으므로 묻지 않는다.
 *
 * ★ 결산 줄(SETTLEMENT)은 금액이 달라도 묻지 않는다 (F-ENT-11). 기본값은 "옮겨둔 금액"이고
 *   실제 쓴 돈이 그와 다른 것은 정정이지 변화가 아니다 — 생활비는 매달 다르게 쓰는 게 정상이라
 *   사유를 받으면 매달 "그냥 그렇게 썼어요" 만 쌓인다. 하드룰 2 의 "차이" 는 계획 대비 변화를 뜻한다.
 */
export function needsReason(line: ReasonableLine): boolean {
  if (line.kind === 'SETTLEMENT') return false;
  if (line.plannedAmount === null || line.actualAmount === null) return false;
  return line.plannedAmount !== line.actualAmount;
}

/**
 * 합계를 내는 데 필요한 최소한의 모양. prisma 타입을 쓰지 않으려고 여기서 다시 적는다.
 * plannedAmount 는 선택이 아니다 — 결산 줄은 이 값이 "옮긴 금액"이라, 안 실어 보내면
 * 0 원을 옮기고 전액을 더 쓴 것으로 계산된다. 타입이 그 실수를 막아야 한다.
 */
export type SummableLine = {
  kind: string;
  plannedAmount: number | null;
  actualAmount: number | null;
};

/**
 * 결산 줄 하나가 이번 달 남은 돈에서 빼는 금액 — 옮겨둔 것보다 더 쓴 만큼만 (F-ENT-11).
 *
 * 덜 썼다고 남은 돈이 늘지는 않는다. 안 쓴 돈은 지난달에 이미 "옮겨둔 돈" 으로 나갔고
 * 그 통장에 그대로 남아 있을 뿐이라, 이번 달 수입으로 다시 세면 이중으로 잡힌다.
 */
export function settlementOverspend(line: SummableLine): number {
  if (line.kind !== 'SETTLEMENT') return 0;
  return Math.max(0, (line.actualAmount ?? 0) - (line.plannedAmount ?? 0));
}

/**
 * 수입 · 고정비 · 추가지출 · 지난달 더 쓴 것을 더하고 남은 돈을 낸다.
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
  let settlementTotal = 0;

  for (const line of lines) {
    const amount = line.actualAmount ?? 0;
    if (line.kind === 'INCOME') income += amount;
    else if (line.kind === 'FIXED') fixedTotal += amount;
    // 결산 줄의 금액은 지난달에 이미 고정비로 나간 돈이다. 더 쓴 만큼만 이번 달에서 뺀다
    else if (line.kind === 'SETTLEMENT') settlementTotal += settlementOverspend(line);
    else extraTotal += amount;
  }

  return {
    income,
    fixedTotal,
    extraTotal,
    settlementTotal,
    surplus: income - fixedTotal - extraTotal - settlementTotal,
  };
}

/**
 * 위저드 진행 표시. 총 스텝 = 줄 스텝 n(결산 + 고정비) + 수입 1 + 추가지출 1 + 특이사항 1 + 확인 1.
 * cursor 는 0 부터 세는 위치라 사람에게는 +1 로 보여주되, 스텝 수를 넘지 않는다.
 *
 * n 은 고정비 항목 수가 아니라 기록에 실제로 있는 줄 수다 — 결산 줄은 항목이 아니라
 * 지난달 기록에서 오므로 항목을 세서는 맞출 수 없다 (F-ENT-11).
 */
export function bookProgress(cursor: number, lineStepCount: number) {
  const total = lineStepCount + 4;
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
