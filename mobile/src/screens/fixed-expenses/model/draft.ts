import type { FixedExpense, FixedExpenseInput } from '@/entities/fixed-expense';
import type { Category } from '@/shared/model/types';

/** 시트가 들고 있는 편집 중인 항목. 결제일은 입력창 그대로 문자열이다 (비어 있을 수 있다). */
export type Draft = {
  id: string | null;
  membershipId: string;
  name: string;
  category: Category;
  defaultAmount: number | null;
  dayOfMonth: string;
};

export function emptyDraft(membershipId: string): Draft {
  return {
    id: null,
    membershipId,
    name: '',
    category: '주거',
    defaultAmount: null,
    dayOfMonth: '',
  };
}

export function draftFromItem(item: FixedExpense, membershipId: string): Draft {
  return {
    id: item.id,
    membershipId,
    name: item.name,
    category: item.category as Category,
    defaultAmount: item.defaultAmount,
    dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '',
  };
}

/** 결제일 입력은 숫자 두 자리까지만 받는다 */
export function sanitizeDay(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, 2);
}

/** 저장 전 검사. 문제가 있으면 사람에게 보여줄 문장, 없으면 null */
export function validateDraft(draft: Draft): string | null {
  if (!draft.name.trim()) return '항목 이름을 적어주세요.';
  const day = draft.dayOfMonth ? Number(draft.dayOfMonth) : null;
  if (day !== null && (day < 1 || day > 31)) return '결제일은 1에서 31 사이여야 해요.';
  return null;
}

/** 서버로 보낼 모양. 금액을 안 적었으면 0 원, 결제일이 비었으면 null */
export function draftToInput(draft: Draft): FixedExpenseInput {
  return {
    name: draft.name.trim(),
    category: draft.category,
    defaultAmount: draft.defaultAmount ?? 0,
    dayOfMonth: draft.dayOfMonth ? Number(draft.dayOfMonth) : null,
  };
}
