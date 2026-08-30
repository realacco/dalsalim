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
  familyKeys,
  fetchFamily,
  regenerateInviteCode,
  removeMember,
  transferOwner,
} from '@/entities/family';
import { useSession } from '@/entities/session';
import { colors, font, radius, space } from '@/shared/config/theme';
import { Button, Card, Divider, Loading, Muted } from '@/shared/ui';

export default function FamilyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId, signOut, refreshMe, selectFamily } = useSession();

  const [copied, setCopied] = useState(false);

  const detail = useQuery({
    queryKey: familyKeys.detail(familyId),
    queryFn: () => fetchFamily(familyId as string),
    enabled: Boolean(familyId),
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

  /** 구성원이 바뀌면 장부의 완성 판정도 바뀐다. 가족·장부 캐시를 같이 비운다. */
  function refetchAll() {
    void queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
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

  const myMembership = detail.data?.members.find((m) => m.isMe);
  const iAmOwner = myMembership?.role === 'OWNER';
  const others = detail.data?.members.filter((m) => !m.isMe) ?? [];
  const busy = remove.isPending || handOver.isPending || leave.isPending;

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
              <Muted>이 코드를 카톡으로 보내면 가족이 참여할 수 있어요.</Muted>

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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  title: { ...font.title, fontWeight: '800', color: colors.ink, paddingHorizontal: space.xs },
  cardTitle: { ...font.bodyLg, fontWeight: '700', color: colors.ink },

  codeBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
    gap: space.xs,
  },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 8, color: colors.ink },
  copyHint: { ...font.caption, color: colors.inkFaint },

  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberActions: { flexDirection: 'row', gap: space.sm },
  member: { gap: space.sm, paddingVertical: space.xs },
  memberName: { ...font.body, fontWeight: '700', color: colors.ink },
  memberMeta: { ...font.caption, color: colors.inkFaint },
  ownerTag: {
    ...font.caption,
    fontWeight: '700',
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },

  familyRow: {
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 2,
  },
  familyRowActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
