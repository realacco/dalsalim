import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { bookKeys, fetchBook } from '@/entities/book';
import { familyKeys, fetchJoinRequests } from '@/entities/family';
import { openMyEntry, reopenEntry } from '@/entities/entry';
import { useSession } from '@/entities/session';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from '@/shared/lib/errors';
import { currentYearMonth, shiftYearMonth } from '@/shared/lib/format';

/**
 * 이번 달 홈의 상태 조립 — 어느 달을 보고 있고, 장부는 어떻고, 기록을 열면 어디로 가는가.
 * 화면은 여기서 받은 것을 그리기만 한다.
 */
export function useThisMonth() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId } = useSession();

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [error, setError] = useState<string | null>(null);

  const membership = me?.memberships.find((m) => m.family.id === familyId);
  const iAmOwner = membership?.role === 'OWNER';
  const isCurrentMonth = yearMonth === currentYearMonth();

  const book = useQuery({
    queryKey: bookKeys.view(familyId, yearMonth),
    queryFn: () => fetchBook(familyId as string, yearMonth),
    enabled: Boolean(familyId),
  });

  /**
   * 들어온 참여 요청. 홈에서도 알려줘야 한다 —
   * 아직 푸시 알림이 없어서, 가족장이 [가족] 탭을 일부러 열어보지 않으면
   * 누가 참여를 기다리고 있는지 영영 모른다. 이 화면은 매달 어차피 열어보는 곳이다.
   */
  const joinRequests = useQuery({
    queryKey: familyKeys.joinRequests(familyId),
    queryFn: () => fetchJoinRequests(familyId as string),
    enabled: Boolean(familyId) && iAmOwner,
  });

  /** 기록을 시작하거나 이어서 연다. 서버가 지난달 값으로 채운 초안을 돌려준다. */
  const openWizard = useMutation({
    mutationFn: () => openMyEntry(familyId as string, yearMonth),
    onSuccess: (entry) => {
      setError(null);
      router.push(`/wizard/${entry.id}`);
    },
    onError: (caught) => setError(errorMessage(caught, MESSAGES.openFailed)),
  });

  /** 제출한 기록을 다시 연다 — 장부가 완성돼 있었다면 다시 진행 중으로 내려간다 */
  const reopen = useMutation({
    mutationFn: async (entryId: string) => {
      await reopenEntry(entryId);
      return entryId;
    },
    onSuccess: (entryId) => {
      void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
      router.push(`/wizard/${entryId}`);
    },
    onError: (caught) => setError(errorMessage(caught, MESSAGES.openFailed)),
  });

  const members = book.data?.members ?? [];
  const mine = members.find((m) => m.isMe);
  const notSubmitted = members.filter((m) => m.status !== 'SUBMITTED');

  return {
    yearMonth,
    isCurrentMonth,
    goPrevMonth: () => setYearMonth(shiftYearMonth(yearMonth, -1)),
    goNextMonth: () => !isCurrentMonth && setYearMonth(shiftYearMonth(yearMonth, 1)),
    familyName: membership?.family.name ?? '',

    book: book.data ?? null,
    isLoading: book.isLoading,
    isFetching: book.isFetching,
    isError: book.isError,
    error: book.error,
    refetch: () => {
      void book.refetch();
      void joinRequests.refetch();
    },

    requests: joinRequests.data ?? [],
    members,
    mine,
    alone: members.length > 0 && members.length - 1 === 0,
    notSubmitted,
    submittedCount: members.length - notSubmitted.length,

    actionError: error,
    busy: openWizard.isPending || reopen.isPending,
    start: () => openWizard.mutate(),
    edit: () => mine?.entryId && reopen.mutate(mine.entryId),

    goFamily: () => router.push('/(tabs)/family'),
    goFixed: () => router.push('/(tabs)/fixed'),
    goSummary: () => router.push(`/summary/${yearMonth}`),
  };
}
