import { api } from '@/shared/api/client';
import type { FixedExpenseGroups, FixedExpenseInput } from '../model/types';

export const fixedExpenseKeys = {
  list: (familyId: string | null) => ['fixed', familyId] as const,
};

export function fetchFixedExpenses(familyId: string) {
  return api<FixedExpenseGroups>(`/families/${familyId}/fixed-expenses`);
}

export function createFixedExpense(
  familyId: string,
  input: FixedExpenseInput & { membershipId: string },
) {
  return api(`/families/${familyId}/fixed-expenses`, { method: 'POST', body: input });
}

export function updateFixedExpense(id: string, input: Partial<FixedExpenseInput>) {
  return api(`/fixed-expenses/${id}`, { method: 'PATCH', body: input });
}

/** 실제로 지우지 않고 active=false 로 둔다. 과거 기록이 이 항목을 참조하고 있다. */
export function deleteFixedExpense(id: string) {
  return api(`/fixed-expenses/${id}`, { method: 'DELETE' });
}
