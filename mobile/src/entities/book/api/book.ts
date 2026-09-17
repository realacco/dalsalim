import { api } from '@/shared/api/client';
import { withEmptyBlocks } from '../model/summary-blocks';
import type { BookView, MonthSummary, TrendPoint } from '../model/types';

export const bookKeys = {
  view: (familyId: string | null, yearMonth: string) => ['book', familyId, yearMonth] as const,
  /** 가족 단위로 한 번에 무효화할 때 쓰는 접두 키 */
  family: (familyId: string | null) => ['book', familyId] as const,
  summary: (familyId: string | null, yearMonth: string) =>
    ['summary', familyId, yearMonth] as const,
  /** 가족의 월 요약 전부. 루트 키가 'book' 이 아니라서 family() 로는 안 비워진다 */
  summaries: (familyId: string | null) => ['summary', familyId] as const,
  trend: (familyId: string | null, months: number) => ['trend', familyId, months] as const,
};

export function fetchBook(familyId: string, yearMonth: string) {
  return api<BookView>(`/families/${familyId}/books/${yearMonth}`);
}

export async function fetchMonthSummary(familyId: string, yearMonth: string) {
  // 옛 서버 응답에 없는 목록 블록을 받친다 — 이유는 withEmptyBlocks 에
  return withEmptyBlocks(
    await api<MonthSummary>(`/families/${familyId}/books/${yearMonth}/summary`),
  );
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
