import { Pressable, RefreshControl, ScrollView, Text } from 'react-native';
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
        <Text style={styles.title}>{f.family?.name ?? '가족'}</Text>

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

        {f.me && f.me.memberships.length > 1 ? (
          <Card style={{ gap: space.md }}>
            <Text style={styles.cardTitle}>가족 바꾸기</Text>
            {f.me.memberships.map((membership) => (
              <Pressable
                key={membership.id}
                onPress={() => f.switchFamily(membership.family.id)}
                style={[
                  styles.familyRow,
                  membership.family.id === f.familyId && styles.familyRowActive,
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
          <Muted>{f.me?.user.nickname}</Muted>
          <Button
            label="로그아웃"
            variant="ghost"
            onPress={() =>
              confirm({
                title: '로그아웃',
                body: '이 기기에서 나갈까요?',
                confirmLabel: '로그아웃',
                destructive: true,
                onConfirm: f.signOut,
              })
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
  title: {
    ...t.font.title,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    paddingHorizontal: t.space.xs,
  },
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

  memberName: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },

  familyRow: {
    padding: t.space.md,
    borderRadius: t.radius.md,
    borderWidth: 1,
    borderColor: t.colors.line,
    gap: 2,
  },
  familyRowActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySoft },
}));
