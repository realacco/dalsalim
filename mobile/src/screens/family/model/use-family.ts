import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';

import { bookKeys } from '@/entities/book';
import {
  DEFAULT_SETTLEMENT,
  approveJoinRequest,
  familyKeys,
  fetchFamily,
  fetchJoinRequests,
  regenerateInviteCode,
  rejectJoinRequest,
  removeMember,
  transferOwner,
  updateMySettlement,
  passedMonthHint,
} from '@/entities/family';
import { useSession } from '@/entities/session';
import { disablePushForThisDevice, enablePushForThisDevice, usePushStore } from '@/features/push';
import type { Settlement } from '@/shared/model/types';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from '@/shared/lib/errors';
import { currentYearMonth } from '@/shared/lib/format';

/**
 * 가족 화면의 상태 조립. 화면은 여기서 받은 것을 그리기만 한다.
 *
 * 조회 2 + 동작 6 이라 화면에 두면 JSX 보다 통신 코드가 길어진다 (CLAUDE.md 분리 기준: 3개 초과).
 * 동작이 실패하면 전부 같은 알림을 띄운다 — 버튼 하나짜리 동작의 실패 표현 규칙.
 */
export function useFamily() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId, signOut, refreshMe, selectFamily } = useSession();

  const [copied, setCopied] = useState(false);

  /** 정산일 시트. draft 가 있으면 열려 있다 (F-FAM-10) */
  const [settlementDraft, setSettlementDraft] = useState<Settlement | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  /** 앱 전체의 값 — 앱을 켤 때의 조용한 재등록 결과도 여기로 온다 */
  const pushState = usePushStore((state) => state.state);

  const detail = useQuery({
    queryKey: familyKeys.detail(familyId),
    queryFn: () => fetchFamily(familyId as string),
    enabled: Boolean(familyId),
  });

  const members = detail.data?.members ?? [];
  const myMembership = members.find((m) => m.isMe);
  /** "이번 달에 보냈다" 표시는 /me 에만 실린다 — 남의 것은 보여줄 일이 없다 */
  const mySession = me?.memberships.find((m) => m.family.id === familyId);
  const iAmOwner = myMembership?.role === 'OWNER';
  const others = members.filter((m) => !m.isMe);

  /**
   * 들어온 참여 요청. OWNER 만 볼 수 있는 API 라서 가족장일 때만 부른다 —
   * 일반 구성원이 부르면 매번 403 을 받는다.
   */
  const joinRequests = useQuery({
    queryKey: familyKeys.joinRequests(familyId),
    queryFn: () => fetchJoinRequests(familyId as string),
    enabled: Boolean(familyId) && iAmOwner,
  });

  const failed = (caught: unknown) =>
    Alert.alert(MESSAGES.actionFailed, errorMessage(caught, MESSAGES.actionFailedBody));

  /** 구성원이 바뀌면 장부의 완성 판정도 바뀐다. 가족·요청·장부 캐시를 같이 비운다. */
  function refetchAll() {
    void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
    void queryClient.invalidateQueries({ queryKey: familyKeys.joinRequests(familyId) });
    void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
    void refreshMe();
  }

  const rotate = useMutation({
    mutationFn: () => regenerateInviteCode(familyId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
      void refreshMe();
    },
    onError: failed,
  });

  const approve = useMutation({
    mutationFn: (membershipId: string) => approveJoinRequest(familyId as string, membershipId),
    onSuccess: refetchAll,
    onError: failed,
  });

  const reject = useMutation({
    mutationFn: (membershipId: string) => rejectJoinRequest(familyId as string, membershipId),
    onSuccess: refetchAll,
    onError: failed,
  });

  const handOver = useMutation({
    mutationFn: (membershipId: string) => transferOwner(familyId as string, membershipId),
    onSuccess: refetchAll,
    onError: failed,
  });

  const remove = useMutation({
    mutationFn: (membershipId: string) => removeMember(familyId as string, membershipId),
    onSuccess: refetchAll,
    onError: failed,
  });

  /** 나가면 이 가족의 화면에 더 있을 이유가 없다. 다른 가족이 있으면 그쪽으로, 없으면 처음으로. */
  const leave = useMutation({
    mutationFn: (membershipId: string) => removeMember(familyId as string, membershipId),
    onSuccess: async () => {
      queryClient.clear();
      const next = await refreshMe();
      const other = next?.memberships[0];
      if (other) {
        await selectFamily(other.family.id);
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    },
    onError: failed,
  });

  /**
   * 정산일 저장 · 안 받기. 저장이 되고 나서 알림 권한을 묻는다 — 정산일을 정한 사람에게
   * 묻는 것이 앱을 켜자마자 묻는 것보다 훨씬 덜 거절당한다. 권한 결과는 카드에 남긴다.
   */
  const saveSettlement = useMutation({
    mutationFn: (settlement: Settlement | null) =>
      updateMySettlement(familyId as string, settlement),
    onSuccess: async (_membership, settlement) => {
      setSettlementDraft(null);
      setSettlementError(null);
      void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
      void refreshMe();
      // 안 받기로 한 사람에게 "꺼져 있어요" 를 안 보이는 건 카드가 정산일 유무로 가른다 — 앱 전체 값은 안 건드린다
      if (settlement) await enablePushForThisDevice({ ask: true });
    },
    onError: (caught) => setSettlementError(errorMessage(caught, MESSAGES.saveFailed)),
  });

  async function copyCode() {
    if (!detail.data) return;
    await Clipboard.setStringAsync(detail.data.family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function switchFamily(nextFamilyId: string) {
    void selectFamily(nextFamilyId);
    void queryClient.invalidateQueries();
  }

  return {
    me,
    familyId,
    family: detail.data?.family ?? null,
    members,
    myMembership,
    iAmOwner,
    others,
    requests: joinRequests.data ?? [],

    isLoading: detail.isLoading,
    isFetching: detail.isFetching,
    isError: detail.isError,
    error: detail.error,
    refetch: () => {
      void detail.refetch();
      void joinRequests.refetch();
      void refreshMe();
    },

    busy:
      remove.isPending ||
      handOver.isPending ||
      leave.isPending ||
      approve.isPending ||
      reject.isPending,
    rotating: rotate.isPending,

    copied,
    copyCode,
    rotateCode: () => rotate.mutate(),
    approve: (membershipId: string) => approve.mutate(membershipId),
    reject: (membershipId: string) => reject.mutate(membershipId),
    handOver: (membershipId: string) => handOver.mutate(membershipId),
    remove: (membershipId: string) => remove.mutate(membershipId),
    leave: () => myMembership && leave.mutate(myMembership.id),
    switchFamily,
    // 토큰이 비면 앱 셸이 로그인으로 보낸다. 그 전에 이 기기의 알림 등록을 무른다 (F-FAM-10).
    // 무르기가 실패하거나 느려도 로그아웃은 한다 — finally. 그동안 버튼은 도는 중으로 보인다
    signingOut,
    signOut: () => {
      setSigningOut(true);
      void disablePushForThisDevice().finally(signOut);
    },

    // 정산일 (F-FAM-10)
    mySettlement: myMembership?.settlement ?? null,
    settlementHint: passedMonthHint(mySession?.settlementNotifiedFor ?? null, currentYearMonth()),
    settlementDraft,
    settlementError,
    savingSettlement: saveSettlement.isPending,
    pushState,
    openSettlement: () => {
      setSettlementError(null);
      setSettlementDraft(myMembership?.settlement ?? DEFAULT_SETTLEMENT);
    },
    editSettlement: (patch: Partial<Settlement>) =>
      setSettlementDraft((draft) => (draft ? { ...draft, ...patch } : draft)),
    closeSettlement: () => {
      setSettlementDraft(null);
      setSettlementError(null);
    },
    saveSettlement: () => settlementDraft && saveSettlement.mutate(settlementDraft),
    /** 정산일은 있는데 아직 권한을 안 물은 기기(폰을 바꿨을 때) — 앱 안에서 바로 묻는다 */
    enablePush: () => void enablePushForThisDevice({ ask: true }),
    clearSettlement: () => {
      setSettlementError(null);
      saveSettlement.mutate(null);
    },
  };
}
