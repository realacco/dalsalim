import { shiftYearMonth } from '@/shared/lib/format';

/**
 * 결산 스텝이 보여줄 "옮긴 것과 얼마나 다른가" (F-ENT-11).
 *
 * 화면은 이 결과만 그린다 — 더 썼는지 덜 썼는지, 그 차이가 남은 돈에 어떻게 들어가는지를
 * 여기서 정한다. 서버의 settlementOverspend 와 같은 규칙이다: 더 쓴 만큼만 이번 달에서 빠진다.
 */
export type SettlementDelta =
  | { kind: 'empty' }
  | { kind: 'same' }
  | { kind: 'over'; amount: number }
  | { kind: 'under'; amount: number };

export function settlementDelta(
  plannedAmount: number,
  actualAmount: number | null,
): SettlementDelta {
  if (actualAmount === null) return { kind: 'empty' };
  if (actualAmount === plannedAmount) return { kind: 'same' };
  if (actualAmount > plannedAmount) return { kind: 'over', amount: actualAmount - plannedAmount };
  return { kind: 'under', amount: plannedAmount - actualAmount };
}

/** 결산 줄이 가리키는 달 — 기록의 달에서 한 달 전. 스텝 제목 "8월 · 생활비" 의 8월이다 */
export function settledYearMonth(entryYearMonth: string): string {
  return shiftYearMonth(entryYearMonth, -1);
}
