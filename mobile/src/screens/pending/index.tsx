// 기능: F-FAM-04 F-SES-06
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  approvedFamilyId,
  cancelJoinRequest,
  exitWithoutRequests,
  familyKeys,
  fetchMyPendingRequests,
  waitingFamilyIds,
} from '@/entities/family';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Loading, Muted, Notice, QueryError } from '@/shared/ui';
import { formatClock } from '@/shared/lib/format';
import { MESSAGES } from '@/shared/config/messages';
import { confirm } from '@/shared/lib/confirm';
import { errorMessage, isSessionExpired } from '@/shared/lib/errors';

/**
 * 초대코드를 넣고 가족장의 승인을 기다리는 동안 머무는 화면.
 *
 * ★ 아직 푸시 알림이 없다. 가족장이 앱을 열지 않으면 요청이 들어온 줄 모른다.
 *   그래서 "기다려주세요"로 끝내면 실제로는 굴러가지 않는다 —
 *   가족장에게 직접 알리라고 분명히 말해주는 게 이 화면의 핵심이다.
 */
export default function PendingScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, refreshMe, selectFamily } = useSession();

  /** 이미 가족이 있는 사람도 이 화면에 온다 (F-FAM-12). 거절돼도 그 가족은 그대로 있다 */
  const hasFamily = (me?.memberships.length ?? 0) > 0;

  /**
   * 확인 버튼이 스스로 상태를 가진다.
   *
   * 뒤에서 10초마다 도는 자동 확인과 버튼을 같은 플래그로 묶으면, 누르지도 않았는데
   * 버튼이 깜빡이고 정작 눌렀을 때는 아무 일도 없어 보인다.
   * checkedAt 은 "눌렀고, 아직 승인 전이더라"를 화면에 남기기 위한 것이다 —
   * 이게 없으면 승인이 안 났을 때 버튼이 먹통처럼 보인다.
   */
  const [checking, setChecking] = useState(false);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const pending = useQuery({
    queryKey: familyKeys.myPending(),
    queryFn: fetchMyPendingRequests,
    // 승인은 다른 사람이 다른 기기에서 누른다. 이 화면에 머무는 동안은 자주 확인해야 한다.
    refetchInterval: 10_000,
  });

  /**
   * 어느 가족을 기다리고 있었는지 — **승인되면 목록에서 사라지므로** 화면이 따로 들고 있어야 한다.
   * 이게 없으면 판정할 것이 "목록에 뭐라도 있나"밖에 안 남는다 (하드룰 8 · F-FAM-04).
   */
  const waiting = useRef<string[]>([]);
  useEffect(() => {
    const requests = pending.data;
    if (requests && requests.length > 0) waiting.current = waitingFamilyIds(requests);
  }, [pending.data]);

  /** 승인이 났는지 확인한다. 났으면 그때부터는 구성원이므로 바로 들여보낸다. */
  const checkApproved = useCallback(async () => {
    setChecking(true);
    try {
      const next = await refreshMe();
      const approved = approvedFamilyId(
        waiting.current,
        (next?.memberships ?? []).map((m) => m.family.id),
      );

      if (approved) {
        // 목록의 첫 번째가 아니라 **기다리던 그 가족**으로 간다
        await selectFamily(approved);
        queryClient.clear();
        /*
          이 확인은 10초마다 뒤에서도 돈다. 그 사이 이 화면 위에 다른 화면(내 정보)이
          얹혀 있으면 replace 가 그 자리만 바꿔 승인 대기가 스택에 남고, 뒤로가기하면
          방금 승인된 사람에게 "거절됐거나 이미 처리된 요청" 이 뜬다 — 이 파일이
          위에서 막아둔 바로 그 화면이다. 먼저 비우고 간다 (앱 셸의 로그아웃과 같은 모양).
        */
        if (router.canDismiss()) router.dismissAll();
        router.replace('/(tabs)');
        return true;
      }

      await pending.refetch();
      setCheckedAt(new Date());
      return false;
    } finally {
      setChecking(false);
    }
    // pending.refetch 는 일부러 의존성에서 뺐다 — 매 렌더 새 함수라 넣으면 아래 effect 가 계속 다시 돈다
  }, [refreshMe, selectFamily, queryClient, router]);

  /**
   * 대기 목록이 비었다고 곧바로 "거절됐어요"를 띄우면 안 된다.
   *
   * 승인이 나도 목록에서 사라지기 때문에 사라진 것만으로는 승인인지 거절인지 알 수 없고,
   * /me 를 봐야 갈린다. 확인하지 않으면 **방금 승인된 사람에게 거절 화면이 뜬다.**
   * 10초마다 도는 자동 확인이 먼저 도착하는 게 보통이라 실제로 그렇게 보였다.
   */
  const resolvedEmpty = useRef(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    const requests = pending.data;
    if (!requests) return;

    if (requests.length > 0) {
      resolvedEmpty.current = false;
      return;
    }

    // 한 번만 확인한다 — 확인 안에서 refetch 를 부르므로 안 막으면 서로를 계속 깨운다
    if (resolvedEmpty.current) return;
    resolvedEmpty.current = true;

    setResolving(true);
    void checkApproved().finally(() => setResolving(false));
  }, [pending.data, checkApproved]);

  const cancel = useMutation({
    mutationFn: cancelJoinRequest,
    onSuccess: async () => {
      const { data } = await pending.refetch();
      // 남은 요청이 있으면 그대로 기다린다. 다 없어졌을 때만 이 화면을 뜬다
      if (data && data.length > 0) return;
      router.replace(exitWithoutRequests(hasFamily));
    },
    onError: (caught) => {
      if (isSessionExpired(caught)) return;
      Alert.alert(MESSAGES.actionFailed, errorMessage(caught, MESSAGES.actionFailedBody));
    },
  });

  /** 요청마다 붙는 동작이라 실패 문구를 어느 줄 아래 붙일지 정할 수 없다 — 위의 Alert 이 받는다 */
  const askCancel = (membershipId: string, familyName: string) =>
    confirm({
      title: '요청 취소',
      body: `${familyName}에 보낸 참여 요청을 무를까요? 다시 요청할 수 있어요.`,
      confirmLabel: '취소하기',
      cancelLabel: '그대로 두기',
      destructive: true,
      onConfirm: () => cancel.mutate(membershipId),
    });

  const requests = pending.data ?? [];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={checking} onRefresh={checkApproved} />}
      >
        {pending.isLoading || resolving ? <Loading /> : null}
        {pending.isError ? (
          <QueryError error={pending.error} onRetry={() => void pending.refetch()} />
        ) : null}

        {requests.length > 0 ? (
          <>
            <View style={{ gap: space.sm }}>
              <Text style={styles.title}>승인을 기다리는 중이에요</Text>
              <Muted>가족장이 승인하면 바로 시작할 수 있어요.</Muted>
            </View>

            <Notice>
              가족장이 승인해야 들어갈 수 있어요. 초대코드만으로는 아무나 우리 가계부를 볼 수 없게
              하기 위해서예요.
            </Notice>

            {/* 여러 가족에 요청했으면 요청한 순서대로 모두 보인다 — 한 건만 그리면 나머지는 취소할 길도 없다 */}
            {requests.map((request) => (
              <Card key={request.membershipId} style={{ gap: space.md }}>
                <Muted>
                  <Text style={styles.strong}>{request.family.name}</Text>에{' '}
                  <Text style={styles.strong}>{request.displayName}</Text>
                  (으)로 참여를 요청했어요.
                </Muted>
                <Button
                  label="요청 취소하기"
                  variant="ghost"
                  loading={cancel.isPending && cancel.variables === request.membershipId}
                  onPress={() => askCancel(request.membershipId, request.family.name)}
                />
              </Card>
            ))}

            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>가족장에게 알려주세요</Text>
              <Muted>
                아직 알림 기능이 없어서, 가족장이 앱을 열어보기 전까지는 요청이 들어온 줄 몰라요.
                카톡으로 “가계부 참여 요청 눌렀어”라고 한마디 보내는 게 제일 빨라요.
              </Muted>
            </Card>

            <View style={{ gap: space.sm }}>
              <Button label="승인됐는지 확인하기" onPress={checkApproved} loading={checking} />
              {checkedAt ? (
                <Muted style={styles.checkedNote}>
                  {formatClock(checkedAt)}에 확인했어요 · 아직 승인 전이에요
                </Muted>
              ) : null}
            </View>
          </>
        ) : null}

        {!pending.isLoading && !pending.isError && !resolving && requests.length === 0 ? (
          <>
            <Text style={styles.title}>기다리는 요청이 없어요</Text>
            {hasFamily ? (
              <>
                <Muted>거절됐거나 이미 처리된 요청이에요. 보던 가족은 그대로 있어요.</Muted>
                <Button label="가족으로 돌아가기" onPress={() => router.replace('/(tabs)')} />
              </>
            ) : (
              <>
                <Muted>거절됐거나 이미 처리된 요청이에요. 다시 참여를 요청할 수 있어요.</Muted>
                <Button label="가족 참여하기" onPress={() => router.replace('/onboarding')} />
              </>
            )}
          </>
        ) : null}

        <View style={{ flex: 1 }} />

        {/*
          로그아웃 버튼을 여기 따로 두지 않는다. 이 화면에는 탭 바가 없어서 예전에는
          나갈 길이 여기뿐이었는데, 이제 내 정보 화면이 그 자리를 맡는다 (F-SES-06).
          문구에 「로그아웃」을 남겨 둔 건 **원래 그 버튼이 있던 자리**이기 때문이다 —
          나가려던 사람이 「내 정보」만 보고 출구를 못 알아보면 이 화면에 갇힌다.
        */}
        <Button label="내 정보 · 로그아웃" variant="ghost" onPress={() => router.push('/me')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { padding: t.space.screen, gap: t.space.lg, flexGrow: 1 },
  title: { ...t.font.display, fontWeight: t.weight.heavy, color: t.colors.ink },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  strong: { fontWeight: t.weight.bold, color: t.colors.ink },
  checkedNote: { textAlign: 'center' },
}));
