import type { MonthSummary } from './types';

/** MonthSummary 에서 배열인 키만 골라 빈 배열을 요구한다 — 목록 블록이 늘면 여기서 컴파일이 막힌다 */
type ListBlocks = {
  [K in keyof MonthSummary as NonNullable<MonthSummary[K]> extends unknown[] ? K : never]: [];
};

const EMPTY_SUMMARY_BLOCKS: ListBlocks = {
  perMember: [],
  changes: [],
  extraIncomes: [],
  extras: [],
  byCategory: [],
  settlements: [],
  notes: [],
};

/**
 * 서버와 앱은 따로 배포된다. 앱이 먼저 올라가면 옛 서버 응답에 새 블록이 없어
 * 화면이 `.length` 에서 죽는다 — 목록 블록은 빈 배열로 받쳐 둔다.
 *
 * 받치는 건 최상위 배열뿐이다. 숫자(extraIncomeTotal 같은 것)는 없어도 `> 0` 비교가 false 라
 * 줄이 숨겨질 뿐 안 죽는다. progress · totals 안의 중첩 목록은 오래된 블록이라 안 받친다 —
 * 새 객체 블록이 생기면 여기가 아니라 그 화면이 다시 열리는 자리다.
 */
export function withEmptyBlocks(summary: MonthSummary): MonthSummary {
  return { ...EMPTY_SUMMARY_BLOCKS, ...summary };
}
