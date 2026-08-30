export type FixedExpense = {
  id: string;
  name: string;
  category: string;
  defaultAmount: number;
  dayOfMonth: number | null;
};

/** 고정비는 항상 사람별로 묶어서 본다. 가족 합계만 보면 아무 대화도 생기지 않는다. */
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

export type FixedExpenseInput = {
  name: string;
  category: string;
  defaultAmount: number;
  dayOfMonth: number | null;
};
