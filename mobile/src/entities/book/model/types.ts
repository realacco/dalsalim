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

/** 요약의 숫자가 몇 명 기준인지. 미제출자가 있어도 요약은 열리므로 항상 같이 읽는다. */
export type SummaryProgress = {
  submittedCount: number;
  memberCount: number;
  pendingMembers: { membershipId: string; displayName: string }[];
};

export type MonthSummary = {
  /** 아직 아무도 안 적은 달은 장부가 없을 수 있다 — 그래도 빈 요약이 열린다 */
  book: { id: string | null; yearMonth: string; status: Book['status'] };
  progress: SummaryProgress;
  totals: EntrySummary;
  perMember: (EntrySummary & {
    membershipId: string;
    displayName: string;
    submitted: boolean;
    note: string | null;
  })[];
  /** "이번 달 달라진 것" — 이 앱이 다른 가계부와 갈라지는 지점 */
  changes: { displayName: string; name: string; kind: LineKind; delta: number; reason: string }[];
  extras: { displayName: string; name: string; category: string; amount: number }[];
  byCategory: { category: string; amount: number }[];
  notes: { displayName: string; note: string }[];
};
