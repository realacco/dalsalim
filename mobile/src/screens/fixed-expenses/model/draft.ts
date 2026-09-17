import type { FixedExpense, FixedExpenseInput } from '@/entities/fixed-expense';
// 배럴이 아니라 model 을 직접 가리킨다 — 배럴은 api 를 거쳐 react-native 를 끌어와 1층 테스트가 못 돈다
import { defaultSettles } from '@/entities/fixed-expense/model/settles';
import type { Category } from '@/shared/model/types';

/** 시트가 들고 있는 편집 중인 항목. 출금일은 입력창 그대로 문자열이다 (비어 있을 수 있다). */
export type Draft = {
  id: string | null;
  membershipId: string;
  name: string;
  description: string;
  category: Category;
  defaultAmount: number | null;
  dayOfMonth: string;
  /** 다음 달에 실제로 쓴 금액을 물을지 (F-FIX-07) */
  settles: boolean;
  /**
   * 사람이 스위치를 직접 건드렸나. 건드리기 전까지만 분류가 기본값을 정한다 —
   * 켜 놓은 것을 분류 한 번 바꿨다고 조용히 끄면 안 된다.
   */
  settlesTouched: boolean;
};

/** 새 항목의 기본 분류. 스위치 기본값도 여기서 나오므로 한 곳에만 적는다 */
const DEFAULT_CATEGORY: Category = '주거';

export function emptyDraft(membershipId: string): Draft {
  return {
    id: null,
    membershipId,
    name: '',
    description: '',
    category: DEFAULT_CATEGORY,
    defaultAmount: null,
    dayOfMonth: '',
    settles: defaultSettles(DEFAULT_CATEGORY),
    settlesTouched: false,
  };
}

export function draftFromItem(item: FixedExpense, membershipId: string): Draft {
  return {
    id: item.id,
    membershipId,
    name: item.name,
    description: item.description ?? '',
    category: item.category as Category,
    defaultAmount: item.defaultAmount,
    dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '',
    settles: item.settles,
    // 저장한 뒤에는 분류와 스위치가 독립이다 — 수정 시트에서 분류를 바꿔도 스위치는 그대로다
    settlesTouched: true,
  };
}

/**
 * 시트의 한 칸을 고친다. 스위치의 기본값이 분류를 따라가는 규칙이 여기 산다.
 *
 * 등록 시트에서 분류를 `생활비` 로 고르면 스위치가 켜지고 다른 분류로 바꾸면 꺼진다 —
 * **사람이 스위치를 직접 건드리기 전까지만.** 저장한 항목은 처음부터 독립이다 (F-FIX-07).
 */
export function patchDraft(draft: Draft, patch: Partial<Draft>): Draft {
  const next = { ...draft, ...patch };
  if ('settles' in patch) return { ...next, settlesTouched: true };
  if ('category' in patch && !draft.settlesTouched) {
    return { ...next, settles: defaultSettles(next.category) };
  }
  return next;
}

/** 출금일 입력은 숫자 두 자리까지만 받는다 */
export function sanitizeDay(text: string): string {
  return text.replace(/[^0-9]/g, '').slice(0, 2);
}

/** 저장 전 검사. 문제가 있으면 사람에게 보여줄 문장, 없으면 null */
export function validateDraft(draft: Draft): string | null {
  if (!draft.name.trim()) return '항목 이름을 적어주세요.';
  const day = draft.dayOfMonth ? Number(draft.dayOfMonth) : null;
  if (day !== null && (day < 1 || day > 31)) return '출금일은 1에서 31 사이여야 해요.';
  return null;
}

/** 서버로 보낼 모양. 금액을 안 적었으면 0 원, 출금일과 설명이 비었으면 null */
export function draftToInput(draft: Draft): FixedExpenseInput {
  return {
    name: draft.name.trim(),
    // 공백만 적은 것은 안 적은 것과 같다. "안 적음"을 두 가지로 표현하지 않는다
    description: draft.description.trim() || null,
    category: draft.category,
    defaultAmount: draft.defaultAmount ?? 0,
    dayOfMonth: draft.dayOfMonth ? Number(draft.dayOfMonth) : null,
    settles: draft.settles,
  };
}
