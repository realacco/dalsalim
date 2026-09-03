import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookKeys } from '@/entities/book';
import {
  type FixedExpense,
  createFixedExpense,
  deleteFixedExpense,
  fetchFixedExpenses,
  fixedExpenseKeys,
  updateFixedExpense,
} from '@/entities/fixed-expense';
import { useSession } from '@/entities/session';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from '@/shared/lib/errors';

import { type Draft, draftFromItem, draftToInput, emptyDraft, validateDraft } from './draft';

/**
 * 고정비 화면의 상태 조립 — 사람별 목록과, 시트에서 편집 중인 항목 하나.
 * 화면은 목록을 그리고, 시트는 draft 를 그린다. 검사·변환 규칙은 model/draft 에 있다.
 */
export function useFixedExpenses() {
  const queryClient = useQueryClient();
  const familyId = useSession((state) => state.familyId);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useQuery({
    queryKey: fixedExpenseKeys.list(familyId),
    queryFn: () => fetchFixedExpenses(familyId as string),
    enabled: Boolean(familyId),
  });

  /** 고정비가 바뀌면 이번 달 장부의 스텝 수도 바뀐다. 장부 캐시를 같이 비운다. */
  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: fixedExpenseKeys.list(familyId) });
    void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
  }

  const save = useMutation({
    mutationFn: (value: Draft) => {
      const input = draftToInput(value);
      return value.id
        ? updateFixedExpense(value.id, input)
        : createFixedExpense(familyId as string, { ...input, membershipId: value.membershipId });
    },
    onSuccess: () => {
      setDraft(null);
      setError(null);
      invalidate();
    },
    onError: (caught) => setError(errorMessage(caught, MESSAGES.saveFailed)),
  });

  const remove = useMutation({
    mutationFn: deleteFixedExpense,
    onSuccess: () => {
      setDraft(null);
      invalidate();
    },
    onError: (caught) => setError(errorMessage(caught, MESSAGES.saveFailed)),
  });

  const total = groups.data?.groups.reduce((sum, group) => sum + group.monthlyTotal, 0) ?? 0;

  return {
    groups: groups.data?.groups ?? [],
    loaded: Boolean(groups.data),
    total,
    isLoading: groups.isLoading,
    isFetching: groups.isFetching,
    isError: groups.isError,
    error: groups.error,
    refetch: () => void groups.refetch(),

    draft,
    draftError: error,
    saving: save.isPending,
    openNew: (membershipId: string) => {
      setError(null);
      setDraft(emptyDraft(membershipId));
    },
    openEdit: (item: FixedExpense, membershipId: string) => {
      setError(null);
      setDraft(draftFromItem(item, membershipId));
    },
    change: (patch: Partial<Draft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev)),
    close: () => {
      setDraft(null);
      setError(null);
    },
    submit: () => {
      if (!draft) return;
      const problem = validateDraft(draft);
      if (problem) {
        setError(problem);
        return;
      }
      save.mutate(draft);
    },
    removeCurrent: () => draft?.id && remove.mutate(draft.id),
  };
}
