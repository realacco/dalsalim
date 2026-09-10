import type { EntryStatus, EntrySummary, LineKind } from '@/shared/model/types';

export type EntryLine = {
  id: string;
  kind: LineKind;
  fixedExpenseId: string | null;
  name: string;
  /** 고정비 항목의 한 줄 설명. 줄에 복사된 값이 아니라 **지금의 항목**에서 온다 */
  description: string | null;
  category: string;
  /** 기본값. 지난달 실제 금액 → 없으면 고정비 등록 금액. null 이면 비교 대상이 없다. */
  plannedAmount: number | null;
  plannedSource: 'LAST_MONTH' | 'FIXED_DEFAULT' | null;
  actualAmount: number | null;
  changeReason: string | null;
};

export type Entry = {
  id: string;
  bookId: string;
  yearMonth: string;
  membershipId: string;
  displayName: string;
  status: EntryStatus;
  note: string | null;
  cursor: number;
  lines: EntryLine[];
  summary: EntrySummary;
};
