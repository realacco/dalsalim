import type {
  BookStatus,
  EntrySummary,
  LineKind,
  MemberEntryStatus,
} from '@/shared/model/types';

export type Book = { id: string; yearMonth: string; status: BookStatus };

/** 홈 화면이 쓰는 한 벌 — 장부 상태 + 사람별 진행 현황 */
export type BookView = {
  book: Book;
  myMembershipId: string;
  isFuture: boolean;
  members: {
    membershipId: string;
    displayName: string;
    isMe: boolean;
    entryId: string | null;
    status: MemberEntryStatus;
    progress: { step: number; total: number } | null;
    summary: EntrySummary | null;
  }[];
};

export type MonthSummary = {
  book: Book;
  totals: EntrySummary;
  perMember: (EntrySummary & { membershipId: string; displayName: string; note: string | null })[];
  /** "이번 달 달라진 것" — 이 앱이 다른 가계부와 갈라지는 지점 */
  changes: { displayName: string; name: string; kind: LineKind; delta: number; reason: string }[];
  extras: { displayName: string; name: string; category: string; amount: number }[];
  byCategory: { category: string; amount: number }[];
  notes: { displayName: string; note: string }[];
};
