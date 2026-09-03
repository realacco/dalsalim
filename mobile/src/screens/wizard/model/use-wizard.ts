import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { type Entry, type EntryLine, entryKeys, fetchEntry, patchEntry } from '@/entities/entry';

export type Step =
  { kind: 'line'; line: EntryLine } | { kind: 'extras' } | { kind: 'note' } | { kind: 'review' };

/**
 * 위저드의 흐름을 담는다 — 어떤 스텝들이 있고, 지금 몇 번째이며, 어떻게 넘어가는가.
 *
 * 스텝 목록은 서버가 내려준 줄에서 그대로 나온다. 수입 1줄 + 고정비 n줄이 각각
 * 한 스텝이고, 뒤에 추가지출·특이사항·확인이 붙는다. 그래서 고정비를 늘리면
 * 스텝도 따라 늘어난다 — 별도 설정이 없다.
 */
export function useWizard(entryId: string | undefined) {
  const [index, setIndex] = useState<number | null>(null);

  const entryQuery = useQuery({
    queryKey: entryKeys.detail(entryId as string),
    queryFn: () => fetchEntry(entryId as string),
    enabled: Boolean(entryId),
  });

  const entry = entryQuery.data;

  const steps = useMemo<Step[]>(() => {
    if (!entry) return [];

    const income = entry.lines.filter((line) => line.kind === 'INCOME');
    const fixed = entry.lines.filter((line) => line.kind === 'FIXED');

    return [
      ...income.map((line) => ({ kind: 'line', line }) as Step),
      ...fixed.map((line) => ({ kind: 'line', line }) as Step),
      { kind: 'extras' },
      { kind: 'note' },
      { kind: 'review' },
    ];
  }, [entry]);

  // 서버가 기억하고 있던 위치에서 이어서 연다
  useEffect(() => {
    if (entry && index === null) {
      setIndex(Math.min(entry.cursor, Math.max(steps.length - 1, 0)));
    }
  }, [entry, index, steps.length]);

  const saveCursor = useMutation({
    mutationFn: (cursor: number) => patchEntry(entryId as string, { cursor }),
  });

  /** 스텝을 넘길 때마다 서버에 위치를 남긴다. 앱을 꺼도 이어서 쓸 수 있어야 한다. */
  function goTo(next: number) {
    setIndex(next);
    if (entry?.status === 'DRAFT') saveCursor.mutate(next);
  }

  return {
    entry: entry as Entry | undefined,
    steps,
    index,
    goTo,
    isLoading: entryQuery.isLoading || index === null || !entry,
    isError: entryQuery.isError,
    error: entryQuery.error,
  };
}
