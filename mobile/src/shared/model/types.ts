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

export type LineKind = 'INCOME' | 'FIXED' | 'EXTRA';
export type EntryStatus = 'DRAFT' | 'SUBMITTED';
/** 홈에서 쓰는 상태. 아직 기록을 시작하지 않았으면 NONE */
export type MemberEntryStatus = EntryStatus | 'NONE';
export type BookStatus = 'OPEN' | 'COMPLETE';
export type Role = 'OWNER' | 'MEMBER';

/** 수입 · 고정비 · 추가지출 · 남은 돈. 개인 단위와 가족 단위 양쪽에서 같은 모양을 쓴다. */
export type EntrySummary = {
  income: number;
  fixedTotal: number;
  extraTotal: number;
  surplus: number;
};
