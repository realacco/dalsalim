import { api } from '@/shared/api/client';
import type { BookView, MonthSummary, TrendPoint } from '../model/types';

export const bookKeys = {
  view: (familyId: string | null, yearMonth: string) => ['book', familyId, yearMonth] as const,
  /** 가족 단위로 한 번에 무효화할 때 쓰는 접두 키 */
  family: (familyId: string | null) => ['book', familyId] as const,
  summary: (familyId: string | null, yearMonth: string) =>
    ['summary', familyId, yearMonth] as const,
  trend: (familyId: string | null, months: number) => ['trend', familyId, months] as const,
};

export function fetchBook(familyId: string, yearMonth: string) {
  return api<BookView>(`/families/${familyId}/books/${yearMonth}`);
}

/** MonthSummary 에서 배열인 키만 골라 빈 배열을 요구한다 — 목록 블록이 늘면 여기서 컴파일이 막힌다 */
type ListBlocks = {
  [K in keyof MonthSummary as MonthSummary[K] extends unknown[] ? K : never]: [];
};

/**
 * 서버와 앱은 따로 배포된다. 앱이 먼저 올라가면 옛 서버 응답에 새 블록이 없어
 * 화면이 `.length` 에서 죽는다 — 목록 블록은 빈 배열로 받쳐 둔다.
 * 숫자(extraIncomeTotal 같은 것)는 없어도 `> 0` 비교가 false 라 줄이 숨겨질 뿐 안 죽으므로 뺀다.
 */
const EMPTY_SUMMARY_BLOCKS: ListBlocks = {
  perMember: [],
  changes: [],
  extraIncomes: [],
  extras: [],
  byCategory: [],
  settlements: [],
  notes: [],
};

export async function fetchMonthSummary(
  familyId: string,
  yearMonth: string,
): Promise<MonthSummary> {
  const summary = await api<MonthSummary>(`/families/${familyId}/books/${yearMonth}/summary`);
  return { ...EMPTY_SUMMARY_BLOCKS, ...summary };
}

/** 장부 상태 재계산 (복구용) */
export function refreshBook(familyId: string, yearMonth: string) {
  return api<{ status: string }>(`/families/${familyId}/books/${yearMonth}/refresh`, {
    method: 'POST',
  });
}

export async function fetchTrend(familyId: string, months = 12) {
  const result = await api<{ months: TrendPoint[] }>(
    `/families/${familyId}/trend?months=${months}`,
  );
  return result.months;
}
