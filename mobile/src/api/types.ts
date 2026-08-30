/** 서버 응답 타입. server/src 의 라우트와 짝을 이룬다. */

export const CATEGORIES = [
  '주거',
  '통신',
  '보험',
  '교통',
  '구독',
  '교육',
  '대출·상환',
  '생활',
  '기타',
] as const;

export type Category = (typeof CATEGORIES)[number];

export type LineKind = 'INCOME' | 'FIXED' | 'EXTRA';
export type EntryStatus = 'DRAFT' | 'SUBMITTED';
export type MemberEntryStatus = EntryStatus | 'NONE';
export type BookStatus = 'OPEN' | 'COMPLETE';

export type Me = {
  user: { id: string; nickname: string; profileImageUrl: string | null; isDev: boolean };
  memberships: {
    id: string;
    role: 'OWNER' | 'MEMBER';
    displayName: string;
    family: { id: string; name: string; inviteCode: string };
  }[];
};

export type FamilyDetail = {
  family: { id: string; name: string; inviteCode: string };
  myMembershipId: string;
  members: {
    id: string;
    displayName: string;
    role: 'OWNER' | 'MEMBER';
    nickname: string;
    profileImageUrl: string | null;
    isMe: boolean;
  }[];
};

export type FixedExpense = {
  id: string;
  name: string;
  category: string;
  defaultAmount: number;
  dayOfMonth: number | null;
};

export type FixedExpenseGroups = {
  myMembershipId: string;
  groups: {
    membershipId: string;
    displayName: string;
    isMe: boolean;
    items: FixedExpense[];
    monthlyTotal: number;
  }[];
};

export type EntrySummary = {
  income: number;
  fixedTotal: number;
  extraTotal: number;
  surplus: number;
};

export type BookView = {
  book: { id: string; yearMonth: string; status: BookStatus };
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

export type EntryLine = {
  id: string;
  kind: LineKind;
  fixedExpenseId: string | null;
  name: string;
  category: string;
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

export type MonthSummary = {
  book: { id: string; yearMonth: string; status: BookStatus };
  totals: EntrySummary;
  perMember: (EntrySummary & { membershipId: string; displayName: string; note: string | null })[];
  changes: { displayName: string; name: string; kind: LineKind; delta: number; reason: string }[];
  extras: { displayName: string; name: string; category: string; amount: number }[];
  byCategory: { category: string; amount: number }[];
  notes: { displayName: string; note: string }[];
};
