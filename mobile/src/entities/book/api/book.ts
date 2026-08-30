import { api } from '@/shared/api/client';
import type { BookView, MonthSummary, TrendPoint } from '../model/types';

export const bookKeys = {
  view: (familyId: string | null, yearMonth: string) => ['book', familyId, yearMonth] as const,
  /** 가족 단위로 한 번에 무효화할 때 쓰는 접두 키 */
  family: (familyId: string | null) => ['book', familyId] as const,
  summary: (familyId: string | null, yearMonth: string) => ['summary', familyId, yearMonth] as const,
  trend: (familyId: string | null, months: number) => ['trend', familyId, months] as const,
};

export function fetchBook(familyId: string, yearMonth: string) {
  return api<BookView>(`/families/${familyId}/books/${yearMonth}`);
}

export function fetchMonthSummary(familyId: string, yearMonth: string) {
  return api<MonthSummary>(`/families/${familyId}/books/${yearMonth}/summary`);
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
