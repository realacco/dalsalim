/**
 * 앱과 서버가 공유하는 상수·타입. server/src/lib/shared.ts 와 짝을 이룬다.
 *
 * 특정 도메인에 속하지 않고 여러 entities 가 함께 쓰는 것만 여기 둔다.
 * entities 끼리는 서로 임포트할 수 없으므로, 공통 조각은 이 아래층에 있어야 한다.
 */

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
 * 줄 종류. 순서가 위저드 순서다. SETTLEMENT 는 "지난달에 옮겨둔 돈을 실제로 얼마나 썼나" 를 묻는
 * 결산 줄이고 (F-ENT-11), EXTRA_INCOME 은 월급 말고 그 달만 들어온 돈이다 (F-ENT-12).
 */
export type LineKind = 'SETTLEMENT' | 'INCOME' | 'EXTRA_INCOME' | 'FIXED' | 'EXTRA';
export type EntryStatus = 'DRAFT' | 'SUBMITTED';
/** 홈에서 쓰는 상태. 아직 기록을 시작하지 않았으면 NONE */
export type MemberEntryStatus = EntryStatus | 'NONE';
export type BookStatus = 'OPEN' | 'COMPLETE';
export type Role = 'OWNER' | 'MEMBER';

/** 수입 · 고정비 · 추가지출 · 지난달 더 쓴 것 · 남은 돈. 개인 단위와 가족 단위 양쪽에서 같은 모양을 쓴다. */
export type EntrySummary = {
  /** 월급 + 기타 수입 */
  income: number;
  /** 그중 월급 말고 들어온 돈 — 0 이면 화면이 줄을 숨긴다 (F-ENT-12) */
  extraIncomeTotal: number;
  fixedTotal: number;
  extraTotal: number;
  /** 지난달에 옮겨둔 돈보다 더 쓴 만큼 — 남은 돈에서 빠진다 (F-ENT-11) */
  settlementTotal: number;
  surplus: number;
};
