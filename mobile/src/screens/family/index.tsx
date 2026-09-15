// 기능: F-FAM-02 F-FAM-06 F-FAM-07 F-FAM-08 F-FAM-09 F-SES-06
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Loading, Muted, QueryError } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

import { useFamily } from './model/use-family';
import { JoinRequestsCard } from './ui/join-requests-card';
import { MembersCard } from './ui/members-card';

/**
 * 가족 화면 — 초대코드 · 참여 요청 · 구성원 · 계정.
 * 상태와 서버 통신은 useFamily 에, 카드 둘은 ui/ 에 있다. 여기는 배치만 한다.
 */
export default function FamilyScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const f = useFamily();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/*
        당겨서 새로고침이 필요하다. 가족이 방금 초대코드로 참여했는지 확인하는 건
        이 앱에서 가장 자주 하는 동작인데, 없으면 앱을 껐다 켜는 수밖에 없다.
      */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={f.isFetching} onRefresh={f.refetch} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{f.family?.name ?? '가족'}</Text>
          {/* 탭을 늘리지 않는다 — 계정 쪽 일은 한 달에 몇 번이라 헤더에 한 줄이면 된다 */}
          <Pressable onPress={() => router.push('/me')} hitSlop={12}>
            <Text style={styles.myPage}>내 정보</Text>
          </Pressable>
        </View>

        {f.isLoading ? <Loading /> : null}
        {f.isError ? <QueryError error={f.error} onRetry={f.refetch} /> : null}

        {f.family ? (
          <>
            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>초대코드</Text>
              <Muted>
                이 코드를 카톡으로 보내면 가족이 참여를 요청할 수 있어요. 요청이 오면
                {f.iAmOwner ? ' 여기서 승인해야' : ' 가족장이 승인해야'} 가계부가 열려요.
              </Muted>

              <Pressable onPress={f.copyCode} style={styles.codeBox}>
                <Text style={styles.code}>{f.family.inviteCode}</Text>
                <Text style={styles.copyHint}>{f.copied ? '복사했어요' : '눌러서 복사'}</Text>
              </Pressable>

              {f.iAmOwner ? (
                <Button
                  label="새 코드 만들기"
                  variant="ghost"
                  loading={f.rotating}
                  onPress={() =>
                    confirm({
                      title: '새 코드 만들기',
                      body: '지금 코드는 더 이상 쓸 수 없게 돼요.',
                      confirmLabel: '만들기',
                      onConfirm: f.rotateCode,
                    })
                  }
                />
              ) : null}
            </Card>

            {f.iAmOwner && f.requests.length > 0 ? (
              <JoinRequestsCard
                requests={f.requests}
                busy={f.busy}
                onApprove={f.approve}
                onReject={f.reject}
              />
            ) : null}

            <MembersCard
              members={f.members}
              iAmOwner={f.iAmOwner}
              canLeave={Boolean(f.myMembership)}
              ownerMustHandOverFirst={f.iAmOwner && f.others.length > 0}
              busy={f.busy}
              onHandOver={f.handOver}
              onRemove={f.remove}
              onLeave={f.leave}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  content: { padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space.xs,
  },
  title: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink },
  myPage: { ...t.font.body, fontWeight: t.weight.semibold, color: t.colors.primary },
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
}));
