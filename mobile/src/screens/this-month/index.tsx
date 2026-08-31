import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import { type BookView, bookKeys, fetchBook } from '@/entities/book';
import { openMyEntry, reopenEntry } from '@/entities/entry';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, ErrorText, Loading, Muted, Notice, Row } from '@/shared/ui';
import { currentYearMonth, formatWon, formatYearMonth, shiftYearMonth } from '@/shared/lib/format';

export default function ThisMonthScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId } = useSession();

  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [error, setError] = useState<string | null>(null);

  const family = me?.memberships.find((m) => m.family.id === familyId)?.family;

  const book = useQuery({
    queryKey: bookKeys.view(familyId, yearMonth),
    queryFn: () => fetchBook(familyId as string, yearMonth),
    enabled: Boolean(familyId),
  });

  /** 기록을 시작하거나 이어서 연다. 서버가 지난달 값으로 채운 초안을 돌려준다. */
  const openWizard = useMutation({
    mutationFn: () => openMyEntry(familyId as string, yearMonth),
    onSuccess: (entry) => {
      setError(null);
      router.push(`/wizard/${entry.id}`);
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '기록을 열지 못했어요.'),
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
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '기록을 열지 못했어요.'),
  });

  const isCurrentMonth = yearMonth === currentYearMonth();
  const members = book.data?.members ?? [];
  const mine = members.find((m) => m.isMe);
  const others = members.filter((m) => !m.isMe);
  const pending = members.filter((m) => m.status !== 'SUBMITTED');
  const submittedCount = members.length - pending.length;
  const remaining = pending.length;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setYearMonth(shiftYearMonth(yearMonth, -1))}
          hitSlop={12}
          style={styles.arrow}
        >
          <Text style={styles.arrowLabel}>‹</Text>
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.month}>{formatYearMonth(yearMonth)}</Text>
          <Muted>{family?.name ?? ''}</Muted>
        </View>

        <Pressable
          onPress={() => !isCurrentMonth && setYearMonth(shiftYearMonth(yearMonth, 1))}
          hitSlop={12}
          style={[styles.arrow, isCurrentMonth && { opacity: 0.25 }]}
          disabled={isCurrentMonth}
        >
          <Text style={styles.arrowLabel}>›</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={book.isFetching} onRefresh={() => void book.refetch()} />
        }
      >
        {book.isLoading ? <Loading /> : null}

        {book.isError ? (
          <Card>
            <ErrorText>
              {book.error instanceof ApiError ? book.error.message : '불러오지 못했어요.'}
            </ErrorText>
            <Button label="다시 시도" variant="ghost" onPress={() => void book.refetch()} />
          </Card>
        ) : null}

        {book.data && mine ? (
          <>
            {/*
              고정비가 하나도 없으면 위저드가 수입·추가지출·특이사항·확인 4스텝으로 끝난다.
              "등록한 고정비가 매달 템플릿이 된다"는 이 앱의 핵심을 첫 사용자가 그대로 건너뛰고,
              두 번째 달에 프리필될 것도 남지 않는다. 그래서 순서를 먼저 안내한다.
            */}
            {mine.fixedExpenseCount === 0 && mine.status === 'NONE' ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>먼저 고정비부터 등록해요</Text>
                <Muted>
                  매달 나가는 돈을 한 번 등록해두면, 다음 달부터는 그 금액이 미리 채워진 채로
                  열려요. 엑셀에서 템플릿을 만드는 일을 여기서 딱 한 번만 하는 거예요.
                </Muted>
                <Button label="고정비 등록하러 가기" onPress={() => router.push('/(tabs)/fixed')} />
              </Card>
            ) : null}

            <MyCard
              status={mine.status}
              progress={mine.progress}
              summary={mine.summary}
              busy={openWizard.isPending || reopen.isPending}
              onStart={() => openWizard.mutate()}
              onEdit={() => mine.entryId && reopen.mutate(mine.entryId)}
            />

            <ErrorText>{error}</ErrorText>

            <Card style={{ gap: space.md }}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>가족 진행 현황</Text>
                <Text
                  style={[
                    styles.badge,
                    book.data.book.status === 'COMPLETE' ? styles.badgeDone : styles.badgeOpen,
                  ]}
                >
                  {book.data.book.status === 'COMPLETE' ? '완성' : `${remaining}명 남음`}
                </Text>
              </View>

              <Divider />

              {book.data.members.map((member) => (
                <View key={member.membershipId} style={styles.memberRow}>
                  <Text style={styles.memberName}>
                    {member.displayName}
                    {member.isMe ? ' (나)' : ''}
                  </Text>
                  <Text style={[styles.memberStatus, styles[statusStyleKey(member.status)]]}>
                    {statusLabel(member.status, member.progress)}
                  </Text>
                </View>
              ))}

              {others.length === 0 ? (
                <Muted>
                  아직 가족이 나뿐이에요. [가족] 탭에서 초대코드를 보내 함께 적어보세요.
                </Muted>
              ) : null}
            </Card>

            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>{formatYearMonth(yearMonth)} 요약</Text>

              {/*
                예전에는 전원이 제출해야 열렸다. 한 명이 앱을 안 쓰기 시작하면 그 달부터
                아무도 아무것도 못 보게 돼서 잠금을 없앴다. 대신 몇 명 기준인지 밝힌다.
              */}
              {submittedCount === 0 ? (
                <Muted>아직 아무도 적지 않았어요. 먼저 시작해보세요.</Muted>
              ) : (
                <>
                  {pending.length > 0 ? (
                    <Notice>
                      {pending.map((m) => m.displayName).join(', ')}님이 아직 안 적었어요 — 아래
                      숫자는 {submittedCount}명 기준이에요.
                    </Notice>
                  ) : (
                    <Muted>가족 모두가 기록을 마쳤어요.</Muted>
                  )}
                  <Button label="요약 보기" onPress={() => router.push(`/summary/${yearMonth}`)} />
                </>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function MyCard({
  status,
  progress,
  summary,
  busy,
  onStart,
  onEdit,
}: {
  status: BookView['members'][number]['status'];
  progress: BookView['members'][number]['progress'];
  summary: BookView['members'][number]['summary'];
  busy: boolean;
  onStart: () => void;
  onEdit: () => void;
}) {
  const styles = useStyles();
  const { space } = useTheme();
  if (status === 'SUBMITTED' && summary) {
    return (
      <Card style={{ gap: space.md }}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>내 기록</Text>
          <Text style={[styles.badge, styles.badgeDone]}>제출 완료</Text>
        </View>

        <Row label="수입" value={formatWon(summary.income)} />
        <Row label="고정비" value={`− ${formatWon(summary.fixedTotal)}`} />
        <Row label="추가 지출" value={`− ${formatWon(summary.extraTotal)}`} />
        <Divider />
        <Row
          label="남은 돈"
          value={formatWon(summary.surplus)}
          strong
          tone={summary.surplus < 0 ? 'up' : 'down'}
        />

        <Button label="수정하기" variant="ghost" onPress={onEdit} loading={busy} />
      </Card>
    );
  }

  const writing = status === 'DRAFT';

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.cardTitle}>내 기록</Text>
      <Text style={styles.prompt}>
        {writing
          ? `적다가 멈춘 곳부터 이어서 쓸 수 있어요.${
              progress ? `\n${progress.step}단계 / ${progress.total}단계` : ''
            }`
          : '월급부터 고정비까지 한 항목씩 물어볼게요.\n오래 걸리지 않아요.'}
      </Text>
      <Button
        label={writing ? '이어서 작성하기' : '이번 달 기록 시작하기'}
        onPress={onStart}
        loading={busy}
      />
    </Card>
  );
}

function statusLabel(
  status: BookView['members'][number]['status'],
  progress: BookView['members'][number]['progress'],
): string {
  if (status === 'SUBMITTED') return '제출 완료';
  if (status === 'DRAFT') return progress ? `작성 중 ${progress.step}/${progress.total}` : '작성 중';
  return '시작 안 함';
}

/**
 * 상태별 색은 스타일 시트에서 고른다.
 * 여기서 useTheme() 을 부르면 렌더 중에 조건부로 훅이 불려 훅 순서가 깨진다.
 * (실제로 "React has detected a change in the order of Hooks" 가 났다)
 */
function statusStyleKey(status: BookView['members'][number]['status']) {
  if (status === 'SUBMITTED') return 'statusSubmitted' as const;
  if (status === 'DRAFT') return 'statusDraft' as const;
  return 'statusNone' as const;
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space.xl,
    paddingVertical: t.space.md,
  },
  statusSubmitted: { color: t.colors.primary },
  statusDraft: { color: t.colors.up },
  statusNone: { color: t.colors.inkFaint },

  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  arrowLabel: { ...t.font.glyph, color: t.colors.inkSoft },
  month: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink },

  content: { padding: t.space.lg, paddingTop: t.space.sm, gap: t.space.lg, paddingBottom: t.space.xxl },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  prompt: { ...t.font.body, color: t.colors.inkSoft },

  badge: {
    ...t.font.caption,
    fontWeight: t.weight.bold,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
  },
  badgeDone: { backgroundColor: t.colors.primarySoft, color: t.colors.primary },
  badgeOpen: { backgroundColor: t.colors.upSoft, color: t.colors.up },

  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  memberStatus: { ...t.font.small, fontWeight: t.weight.bold },
}));
