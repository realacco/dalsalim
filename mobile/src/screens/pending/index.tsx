import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import { cancelJoinRequest, familyKeys, fetchMyPendingRequests } from '@/entities/family';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Loading, Muted, Notice } from '@/shared/ui';
import { formatClock } from '@/shared/lib/format';

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
  const { me, refreshMe, selectFamily, signOut } = useSession();

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

  /** 승인이 났는지 확인한다. 났으면 그때부터는 구성원이므로 바로 들여보낸다. */
  const checkApproved = useCallback(async () => {
    setChecking(true);
    try {
      const next = await refreshMe();
      const joined = next?.memberships[0];

      if (joined) {
        await selectFamily(joined.family.id);
        queryClient.clear();
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
      await pending.refetch();
      router.replace('/onboarding');
    },
    onError: (caught) =>
      Alert.alert('안 됐어요', caught instanceof ApiError ? caught.message : '다시 시도해주세요.'),
  });

  const request = pending.data?.[0];

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={checking} onRefresh={checkApproved} />
        }
      >
        {pending.isLoading || resolving ? <Loading /> : null}

        {request ? (
          <>
            <View style={{ gap: space.sm }}>
              <Text style={styles.title}>승인을 기다리는 중이에요</Text>
              <Muted>
                {request.family.name}에 <Text style={styles.strong}>{request.displayName}</Text>
                (으)로 참여를 요청했어요.
              </Muted>
            </View>

            <Notice>
              가족장이 승인해야 들어갈 수 있어요. 초대코드만으로는 아무나 우리 가계부를 볼 수 없게
              하기 위해서예요.
            </Notice>

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

            <Button
              label="요청 취소하기"
              variant="ghost"
              loading={cancel.isPending}
              onPress={() =>
                Alert.alert('요청 취소', '참여 요청을 무를까요? 다시 요청할 수 있어요.', [
                  { text: '그대로 두기', style: 'cancel' },
                  { text: '취소하기', style: 'destructive', onPress: () => cancel.mutate(request.membershipId) },
                ])
              }
            />
          </>
        ) : null}

        {!pending.isLoading && !resolving && !request ? (
          <>
            <Text style={styles.title}>기다리는 요청이 없어요</Text>
            <Muted>거절됐거나 이미 처리된 요청이에요. 다시 참여를 요청할 수 있어요.</Muted>
            <Button label="가족 참여하기" onPress={() => router.replace('/onboarding')} />
          </>
        ) : null}

        <View style={{ flex: 1 }} />

        <Card style={{ gap: space.md }}>
          <Text style={styles.cardTitle}>계정</Text>
          <Muted>{me?.user.nickname}</Muted>
          <Button
            label="로그아웃"
            variant="ghost"
            onPress={async () => {
              await signOut();
              queryClient.clear();
              router.replace('/login');
            }}
          />
        </Card>
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
