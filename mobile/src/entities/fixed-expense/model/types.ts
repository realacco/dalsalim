export type FixedExpense = {
  id: string;
  name: string;
  /** 목록에서 이름 아래 한 줄로 보이는 설명. 안 적었으면 null */
  description: string | null;
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
  description: string | null;
  category: string;
  defaultAmount: number;
  dayOfMonth: number | null;
};
