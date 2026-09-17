import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';

import { bookKeys } from '@/entities/book';
import {
  DEFAULT_SETTLEMENT,
  approveJoinRequest,
  deleteFamily,
  familyKeys,
  fetchFamily,
  fetchJoinRequests,
  regenerateInviteCode,
  rejectJoinRequest,
  removeMember,
  transferOwner,
  updateMyDisplayName,
  updateMySettlement,
  passedMonthHint,
} from '@/entities/family';
import { fixedExpenseKeys } from '@/entities/fixed-expense';
import { useSession } from '@/entities/session';
import { enablePushForThisDevice, usePushStore } from '@/features/push';
import type { Settlement } from '@/shared/model/types';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage, isSessionExpired } from '@/shared/lib/errors';
import { NAME_MAX_LENGTH, currentYearMonth, truncateText } from '@/shared/lib/format';

/**
 * 가족 화면의 상태 조립. 화면은 여기서 받은 것을 그리기만 한다.
 *
 * 조회 2 + 동작 7 이라 화면에 두면 JSX 보다 통신 코드가 길어진다 (CLAUDE.md 분리 기준: 3개 초과).
 * 동작이 실패하면 전부 같은 알림을 띄운다 — 버튼 하나짜리 동작의 실패 표현 규칙.
 */
export function useFamily() {
  const router = useRouter();
  const queryClient = useQueryClient();
  // me 는 정산일 힌트(F-FAM-10)가 쓴다 — 계정 카드가 내 정보로 간 뒤에도 남는 이유다
  const { me, familyId, refreshMe, selectFamily } = useSession();

  const [copied, setCopied] = useState(false);

  /** 정산일 시트. draft 가 있으면 열려 있다 (F-FAM-10) */
  const [settlementDraft, setSettlementDraft] = useState<Settlement | null>(null);
  const [settlementError, setSettlementError] = useState<string | null>(null);
  /**
   * 이 가족 안 내 이름 편집 (F-FAM-07). null 이면 편집 중이 아니다.
   * 어느 가족에서 열었는지 같이 쥔다 — 가족 탭은 내 정보 아래 깔린 채 남아 있어서, 편집을 열어둔 채
   * 내 정보에서 다른 가족으로 바꾸고 돌아오면 칸이 그대로 열려 [저장] 이 A 의 이름을 B 에 쓴다.
   * 바뀐 뒤에 effect 로 비우면 한 프레임은 열린 칸이 보이므로, 가족이 다르면 처음부터 닫힌 것으로 읽는다.
   * 가리기만 하지 않고 같은 렌더에서 비운다 — A → B → A 로 돌아왔을 때 그사이 다른 기기에서 바뀐 이름 위에
   * 옛 draft 가 다시 열리면 안 된다 (렌더 중 setState 로 파생 상태를 맞추는 React 의 권장 모양)
   */
  const [nameEdit, setNameEdit] = useState<{
    familyId: string | null;
    draft: string;
    error: string | null;
  } | null>(null);
  const openNameEdit = nameEdit?.familyId === familyId ? nameEdit : null;
  if (nameEdit && !openNameEdit) setNameEdit(null);

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
   * 구성원 관리 시트 (F-FAM-08 · F-FAM-09). 누구의 시트인지 id 로만 쥐고 사람은 목록에서 찾는다 —
   * 당겨서 새로고침으로 그 사람이 빠졌거나(다른 기기에서 내보냄) 가족을 바꿨거나 내가 더는 가족장이
   * 아니면 찾지 못해 닫힌 것으로 읽는다. 없는 사람의 시트가 열린 채 [내보내기] 가 눌리지 않게.
   * 이름 편집과 같은 이유로 같은 렌더에서 비운다 — 돌아왔을 때 옛 시트가 다시 열리면 안 된다
   */
  const [managing, setManaging] = useState<{ familyId: string | null; id: string } | null>(null);
  const managedMember =
    iAmOwner && managing?.familyId === familyId
      ? (others.find((m) => m.id === managing.id) ?? null)
      : null;
  if (managing && !managedMember) setManaging(null);

  /**
   * 들어온 참여 요청. OWNER 만 볼 수 있는 API 라서 가족장일 때만 부른다 —
   * 일반 구성원이 부르면 매번 403 을 받는다.
   */
  const joinRequests = useQuery({
    queryKey: familyKeys.joinRequests(familyId),
    queryFn: () => fetchJoinRequests(familyId as string),
    enabled: Boolean(familyId) && iAmOwner,
  });

  const failed = (caught: unknown) => {
    if (isSessionExpired(caught)) return;
    Alert.alert(MESSAGES.actionFailed, errorMessage(caught, MESSAGES.actionFailedBody));
  };

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

  /** 이 가족을 떠난 뒤 갈 곳. 다른 가족이 있으면 그쪽으로, 없으면 처음으로. 나가기와 없애기가 같다 */
  async function afterLeavingFamily() {
    queryClient.clear();
    const next = await refreshMe();
    const other = next?.memberships[0];
    if (other) {
      await selectFamily(other.family.id);
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }

  const leave = useMutation({
    mutationFn: (membershipId: string) => removeMember(familyId as string, membershipId),
    onSuccess: afterLeavingFamily,
    onError: failed,
  });

  /**
   * 가족 없애기 (F-FAM-11) — 구성원이 나 하나뿐일 때만 버튼이 보인다.
   * 혼자인 가족장은 나갈 수가 없다. 나가면 초대코드만 살아 있는 가족이 남기 때문이다.
   */
  const removeFamily = useMutation({
    mutationFn: () => deleteFamily(familyId as string),
    onSuccess: afterLeavingFamily,
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

  /**
   * 내 이름 저장 (F-FAM-07). 실패하면 입력 아래 붉은 한 줄로 남기고 입력은 그대로 둔다 — 폼 안 저장 실패 규칙.
   * 내 이름을 그리는 화면의 캐시를 다 비운다 — 기록에는 이름을 복사해 두지 않아서 지난 달에도 새 이름이
   * 보여야 한다. 이번 달(장부) · 월 요약 · 고정비 탭(사람별 묶음) · 내 정보(/me) 넷이다.
   * 추이는 이름을 안 싣고, 기록 상세(entry)는 이름을 싣지만 화면이 안 그려서 안 비운다.
   * /me 도 다시 부른다 — 내 정보의 「내 가족」 목록이 이 이름을 보여준다
   */
  const saveName = useMutation({
    mutationFn: (displayName: string) => updateMyDisplayName(familyId as string, displayName),
    // 다시 누르면 지난번 붉은 줄을 지운다 — 요청이 도는 동안 옛 문구가 남아 있지 않게 (내 정보와 같다)
    onMutate: () => setNameEdit((edit) => (edit ? { ...edit, error: null } : edit)),
    onSuccess: () => {
      setNameEdit(null);
      void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.summaries(familyId) });
      void queryClient.invalidateQueries({ queryKey: fixedExpenseKeys.list(familyId) });
      void refreshMe();
    },
    onError: (caught) => {
      if (isSessionExpired(caught)) return;
      const error = errorMessage(caught, MESSAGES.saveFailed);
      setNameEdit((edit) => (edit ? { ...edit, error } : edit));
    },
  });

  async function copyCode() {
    if (!detail.data) return;
    await Clipboard.setStringAsync(detail.data.family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return {
    family: detail.data?.family ?? null,
    members,
    myMembership,
    iAmOwner,
    others,
    /**
     * 가족장이 나가려면 먼저 할 일이 있다 — 남은 사람이 있으면 넘기고, 나 혼자면 없앤다 (F-FAM-11).
     * 배타적인 두 갈래라 boolean 둘로 내려보내면 어긋날 수 있어 하나로 정한다.
     */
    ownerExit: iAmOwner ? (others.length > 0 ? ('handover' as const) : ('delete' as const)) : null,
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
      removeFamily.isPending ||
      approve.isPending ||
      reject.isPending,
    rotating: rotate.isPending,

    copied,
    copyCode,
    rotateCode: () => rotate.mutate(),
    approve: (membershipId: string) => approve.mutate(membershipId),
    reject: (membershipId: string) => reject.mutate(membershipId),
    // 확인까지 받았으면 시트는 할 일을 다 했다. 실패하면 알림이 뜨고 줄에서 다시 열면 된다
    handOver: (membershipId: string) => {
      setManaging(null);
      handOver.mutate(membershipId);
    },
    remove: (membershipId: string) => {
      setManaging(null);
      remove.mutate(membershipId);
    },
    managedMember,
    manageMember: (membershipId: string) => setManaging({ familyId, id: membershipId }),
    closeManage: () => setManaging(null),
    leave: () => myMembership && leave.mutate(myMembership.id),
    deleteFamily: () => removeFamily.mutate(),
    contents: detail.data?.contents ?? null,

    // 이 가족 안 내 이름 (F-FAM-07)
    nameDraft: openNameEdit?.draft ?? null,
    nameError: openNameEdit?.error ?? null,
    savingName: saveName.isPending,
    editName: () =>
      setNameEdit({
        familyId,
        // 20자 규칙 전에 들어온 이름이 있으면 입력 칸이 못 받는다 — 잘라서 연다
        draft: truncateText(myMembership?.displayName ?? '', NAME_MAX_LENGTH),
        error: null,
      }),
    changeName: (draft: string) => setNameEdit((edit) => (edit ? { ...edit, draft } : edit)),
    cancelName: () => setNameEdit(null),
    saveName: () => openNameEdit && saveName.mutate(openNameEdit.draft),

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
