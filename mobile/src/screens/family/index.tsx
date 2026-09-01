import { useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import {
  approveJoinRequest,
  familyKeys,
  fetchFamily,
  fetchJoinRequests,
  regenerateInviteCode,
  rejectJoinRequest,
  removeMember,
  transferOwner,
} from '@/entities/family';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Loading, Muted } from '@/shared/ui';

export default function FamilyScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId, signOut, refreshMe, selectFamily } = useSession();

  const [copied, setCopied] = useState(false);

  const detail = useQuery({
    queryKey: familyKeys.detail(familyId),
    queryFn: () => fetchFamily(familyId as string),
    enabled: Boolean(familyId),
  });

  const myMembership = detail.data?.members.find((m) => m.isMe);
  const iAmOwner = myMembership?.role === 'OWNER';

  /**
   * 들어온 참여 요청. OWNER 만 볼 수 있는 API 라서 가족장일 때만 부른다 —
   * 일반 구성원이 부르면 매번 403 을 받는다.
   */
  const joinRequests = useQuery({
    queryKey: familyKeys.joinRequests(familyId),
    queryFn: () => fetchJoinRequests(familyId as string),
    enabled: Boolean(familyId) && iAmOwner,
  });

  const rotate = useMutation({
    mutationFn: () => regenerateInviteCode(familyId as string),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
      void refreshMe();
    },
    onError: (caught) =>
      Alert.alert('안 됐어요', caught instanceof ApiError ? caught.message : '다시 시도해주세요.'),
  });

  /** 구성원이 바뀌면 장부의 완성 판정도 바뀐다. 가족·요청·장부 캐시를 같이 비운다. */
  function refetchAll() {
    void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
    void queryClient.invalidateQueries({ queryKey: familyKeys.joinRequests(familyId) });
    void queryClient.invalidateQueries({ queryKey: ['book', familyId] });
    void refreshMe();
  }

  const failed = (caught: unknown) =>
    Alert.alert('안 됐어요', caught instanceof ApiError ? caught.message : '다시 시도해주세요.');

  const remove = useMutation({
    mutationFn: (membershipId: string) => removeMember(familyId as string, membershipId),
    onSuccess: refetchAll,
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

  const others = detail.data?.members.filter((m) => !m.isMe) ?? [];
  const busy =
    remove.isPending ||
    handOver.isPending ||
    leave.isPending ||
    approve.isPending ||
    reject.isPending;
  const requests = joinRequests.data ?? [];

  async function copyCode() {
    if (!detail.data) return;
    await Clipboard.setStringAsync(detail.data.family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/*
        당겨서 새로고침이 필요하다. 가족이 방금 초대코드로 참여했는지 확인하는 건
        이 앱에서 가장 자주 하는 동작인데, 없으면 앱을 껐다 켜는 수밖에 없다.
      */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={detail.isFetching}
            onRefresh={() => {
              void detail.refetch();
              void joinRequests.refetch();
              void refreshMe();
            }}
          />
        }
      >
        <Text style={styles.title}>{detail.data?.family.name ?? '가족'}</Text>

        {detail.isLoading ? <Loading /> : null}

        {detail.data ? (
          <>
            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>초대코드</Text>
              <Muted>
                이 코드를 카톡으로 보내면 가족이 참여를 요청할 수 있어요. 요청이 오면
                {iAmOwner ? ' 여기서 승인해야' : ' 가족장이 승인해야'} 가계부가 열려요.
              </Muted>

              <Pressable onPress={copyCode} style={styles.codeBox}>
                <Text style={styles.code}>{detail.data.family.inviteCode}</Text>
                <Text style={styles.copyHint}>{copied ? '복사했어요' : '눌러서 복사'}</Text>
              </Pressable>

              {iAmOwner ? (
                <Button
                  label="새 코드 만들기"
                  variant="ghost"
                  loading={rotate.isPending}
                  onPress={() =>
                    Alert.alert('새 코드 만들기', '지금 코드는 더 이상 쓸 수 없게 돼요.', [
                      { text: '취소', style: 'cancel' },
                      { text: '만들기', onPress: () => rotate.mutate() },
                    ])
                  }
                />
              ) : null}
            </Card>

            {/*
              초대코드는 카톡으로 오가다 새어나갈 수 있다. 코드를 맞힌 사람은 여기 대기로 걸리고,
              가족장이 승인해야 가계부를 볼 수 있다. 알림이 아직 없어서 이 카드가 유일한 통로다 —
              그래서 요청이 있으면 구성원 목록보다 위에 둔다.
            */}
            {iAmOwner && requests.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>참여 요청 {requests.length}건</Text>
                <Muted>초대코드를 넣은 사람이에요. 아는 사람이 맞는지 확인하고 승인해주세요.</Muted>
                <Divider />

                {requests.map((request) => (
                  <View key={request.id} style={styles.member}>
                    <View style={styles.memberRow}>
                      <View style={{ gap: 2 }}>
                        <Text style={styles.memberName}>{request.displayName}</Text>
                        <Text style={styles.memberMeta}>{request.nickname}</Text>
                      </View>
                    </View>

                    <View style={styles.memberActions}>
                      <Button
                        label="승인"
                        disabled={busy}
                        style={{ flex: 1 }}
                        onPress={() =>
                          Alert.alert(
                            `${request.displayName}님 승인`,
                            '승인하면 우리 가족의 가계부를 볼 수 있고, 이번 달 장부에도 함께 들어가요.',
                            [
                              { text: '취소', style: 'cancel' },
                              { text: '승인', onPress: () => approve.mutate(request.id) },
                            ],
                          )
                        }
                      />
                      <Button
                        label="거절"
                        variant="ghost"
                        disabled={busy}
                        style={{ flex: 1 }}
                        onPress={() =>
                          Alert.alert(
                            `${request.displayName}님 거절`,
                            '요청이 사라져요. 모르는 사람이면 초대코드도 새로 만드는 게 좋아요.',
                            [
                              { text: '취소', style: 'cancel' },
                              {
                                text: '거절',
                                style: 'destructive',
                                onPress: () => reject.mutate(request.id),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>구성원 {detail.data.members.length}명</Text>
              <Divider />
              {detail.data.members.map((member) => (
                <View key={member.id} style={styles.member}>
                  <View style={styles.memberRow}>
                    <View style={{ gap: 2 }}>
                      <Text style={styles.memberName}>
                        {member.displayName}
                        {member.isMe ? ' (나)' : ''}
                      </Text>
                      <Text style={styles.memberMeta}>{member.nickname}</Text>
                    </View>
                    {member.role === 'OWNER' ? <Text style={styles.ownerTag}>가족장</Text> : null}
                  </View>

                  {/* 가족장만 남을 다룰 수 있다. 되돌리기 어려운 동작이라 항상 확인을 받는다. */}
                  {iAmOwner && !member.isMe ? (
                    <View style={styles.memberActions}>
                      <Button
                        label="가족장 넘기기"
                        variant="ghost"
                        disabled={busy}
                        style={{ flex: 1 }}
                        onPress={() =>
                          Alert.alert(
                            '가족장 넘기기',
                            `${member.displayName}님이 가족장이 되고, 나는 일반 구성원이 돼요.`,
                            [
                              { text: '취소', style: 'cancel' },
                              { text: '넘기기', onPress: () => handOver.mutate(member.id) },
                            ],
                          )
                        }
                      />
                      <Button
                        label="내보내기"
                        variant="ghost"
                        disabled={busy}
                        style={{ flex: 1 }}
                        onPress={() =>
                          Alert.alert(
                            `${member.displayName}님 내보내기`,
                            '앞으로의 장부에서 빠져요. 지금까지 적은 기록은 그대로 남습니다.',
                            [
                              { text: '취소', style: 'cancel' },
                              {
                                text: '내보내기',
                                style: 'destructive',
                                onPress: () => remove.mutate(member.id),
                              },
                            ],
                          )
                        }
                      />
                    </View>
                  ) : null}
                </View>
              ))}

              <Divider />

              {/*
                가족장이 그냥 나가면 주인 없는 가족이 남는다. 서버가 막지만,
                버튼을 눌러보고 나서 알게 되면 늦으므로 여기서 먼저 안내한다.
              */}
              {iAmOwner && others.length > 0 ? (
                <Muted>
                  가족장은 바로 나갈 수 없어요. 위에서 다른 구성원에게 가족장을 넘긴 뒤에 나갈 수
                  있어요.
                </Muted>
              ) : (
                <Button
                  label="가족에서 나가기"
                  variant="ghost"
                  disabled={busy || !myMembership}
                  onPress={() =>
                    Alert.alert(
                      '가족에서 나가기',
                      '앞으로의 장부에서 빠져요. 지금까지 적은 기록은 그대로 남습니다.',
                      [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '나가기',
                          style: 'destructive',
                          onPress: () => myMembership && leave.mutate(myMembership.id),
                        },
                      ],
                    )
                  }
                />
              )}
            </Card>
          </>
        ) : null}

        {me && me.memberships.length > 1 ? (
          <Card style={{ gap: space.md }}>
            <Text style={styles.cardTitle}>가족 바꾸기</Text>
            {me.memberships.map((membership) => (
              <Pressable
                key={membership.id}
                onPress={() => {
                  void selectFamily(membership.family.id);
                  void queryClient.invalidateQueries();
                }}
                style={[
                  styles.familyRow,
                  membership.family.id === familyId && styles.familyRowActive,
                ]}
              >
                <Text style={styles.memberName}>{membership.family.name}</Text>
                <Muted>{membership.displayName}</Muted>
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: space.md }}>
          <Text style={styles.cardTitle}>계정</Text>
          <Muted>{me?.user.nickname}</Muted>
          <Button
            label="로그아웃"
            variant="ghost"
            onPress={() =>
              Alert.alert('로그아웃', '이 기기에서 나갈까요?', [
                { text: '취소', style: 'cancel' },
                {
                  text: '로그아웃',
                  style: 'destructive',
                  onPress: async () => {
                    await signOut();
                    queryClient.clear();
                    router.replace('/login');
                  },
                },
              ])
            }
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxl },
  title: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink, paddingHorizontal: t.space.xs },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },

  codeBox: {
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.md,
    paddingVertical: t.space.lg,
    alignItems: 'center',
    gap: t.space.xs,
  },
  code: { ...t.font.code, fontWeight: t.weight.heavy, color: t.colors.ink },
  copyHint: { ...t.font.caption, color: t.colors.inkFaint },

  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberActions: { flexDirection: 'row', gap: t.space.sm },
  member: { gap: t.space.sm, paddingVertical: t.space.xs },
  memberName: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },
  memberMeta: { ...t.font.caption, color: t.colors.inkFaint },
  ownerTag: {
    ...t.font.caption,
    fontWeight: t.weight.bold,
    color: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
  },

  familyRow: {
    padding: t.space.md,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.line,
    gap: 2,
  },
  familyRowActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySoft },
}));
