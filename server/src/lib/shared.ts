/** 앱과 서버가 공유하는 상수·타입. 앱 쪽 src/shared/model/types.ts 와 짝을 이룬다. */

export const CATEGORIES = [
  '주거',
  '통신',
  '보험',
  '교통',
  '구독',
  '교육',
  '대출·상환',
  '생활',
  '기타',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const LINE_KINDS = ['INCOME', 'FIXED', 'EXTRA'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

export type EntryStatus = 'DRAFT' | 'SUBMITTED';
export type BookStatus = 'OPEN' | 'COMPLETE';
export type Role = 'OWNER' | 'MEMBER';

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

/**
 * 사유가 반드시 필요한가?
 * 기본값이 있고(= 비교 대상이 있고) 실제 금액이 그와 다르면 필수다.
 * 기본값이 없는 첫 달과 추가 지출은 비교 대상이 없으므로 묻지 않는다.
 */
export function needsReason(plannedAmount: number | null, actualAmount: number | null): boolean {
  if (plannedAmount === null || actualAmount === null) return false;
  return plannedAmount !== actualAmount;
}
