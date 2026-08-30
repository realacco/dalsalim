import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api } from '../../src/api/client';
import type { FamilyDetail } from '../../src/api/types';
import { useSession } from '../../src/store/session';
import { colors, font, radius, space } from '../../src/theme';
import { Button, Card, Divider, Loading, Muted } from '../../src/components/ui';

export default function FamilyScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId, signOut, refreshMe, selectFamily } = useSession();

  const [copied, setCopied] = useState(false);

  const detail = useQuery({
    queryKey: ['family', familyId],
    queryFn: () => api<FamilyDetail>(`/families/${familyId}`),
    enabled: Boolean(familyId),
  });

  const rotate = useMutation({
    mutationFn: () => api(`/families/${familyId}/invite-code`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['family', familyId] });
      void refreshMe();
    },
    onError: (caught) =>
      Alert.alert('안 됐어요', caught instanceof ApiError ? caught.message : '다시 시도해주세요.'),
  });

  const iAmOwner = detail.data?.members.find((m) => m.isMe)?.role === 'OWNER';

  async function copyCode() {
    if (!detail.data) return;
    await Clipboard.setStringAsync(detail.data.family.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
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
                <View key={member.id} style={styles.memberRow}>
                  <View style={{ gap: 2 }}>
                    <Text style={styles.memberName}>
                      {member.displayName}
                      {member.isMe ? ' (나)' : ''}
                    </Text>
                    <Text style={styles.memberMeta}>{member.nickname}</Text>
                  </View>
                  {member.role === 'OWNER' ? <Text style={styles.ownerTag}>가족장</Text> : null}
                </View>
              ))}
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
