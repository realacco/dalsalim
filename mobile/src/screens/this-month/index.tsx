import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, ErrorText, Loading, Muted, Notice, QueryError } from '@/shared/ui';
import { formatYearMonth } from '@/shared/lib/format';

import { bookBadge, statusLabel, statusStyleKey } from './model/status';
import { useThisMonth } from './model/use-this-month';
import { MyCard } from './ui/my-card';

/**
 * 이번 달 홈 — 내 기록 · 가족 진행 현황 · 요약 입구.
 * 상태와 서버 통신은 useThisMonth 에, 표시 문구 규칙은 model/status 에 있다. 여기는 배치만 한다.
 */
export default function ThisMonthScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const m = useThisMonth();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={m.goPrevMonth} hitSlop={12} style={styles.arrow}>
          <Text style={styles.arrowLabel}>‹</Text>
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.month}>{formatYearMonth(m.yearMonth)}</Text>
          <Muted>{m.familyName}</Muted>
        </View>

        <Pressable
          onPress={m.goNextMonth}
          hitSlop={12}
          style={[styles.arrow, m.isCurrentMonth && { opacity: 0.25 }]}
          disabled={m.isCurrentMonth}
        >
          <Text style={styles.arrowLabel}>›</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={m.isFetching} onRefresh={m.refetch} />}
      >
        {m.isLoading ? <Loading /> : null}
        {m.isError ? <QueryError error={m.error} onRetry={m.refetch} /> : null}

        {m.book && m.mine ? (
          <>
            {m.requests.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>
                  참여 요청 {m.requests.length}건이 기다리고 있어요
                </Text>
                <Muted>
                  {m.requests.map((request) => request.displayName).join(', ')}님이 초대코드로
                  참여를 요청했어요. 승인해야 함께 적을 수 있어요.
                </Muted>
                <Button label="확인하러 가기" onPress={m.goFamily} />
              </Card>
            ) : null}

            {/*
              고정비가 하나도 없으면 위저드가 수입·추가지출·특이사항·확인 4스텝으로 끝난다.
              "등록한 고정비가 매달 템플릿이 된다"는 이 앱의 핵심을 첫 사용자가 그대로 건너뛰고,
              두 번째 달에 프리필될 것도 남지 않는다. 그래서 순서를 먼저 안내한다.
            */}
            {m.mine.fixedExpenseCount === 0 && m.mine.status === 'NONE' ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>먼저 고정비부터 등록해요</Text>
                <Muted>
                  매달 나가는 돈을 한 번 등록해두면, 다음 달부터는 그 금액이 미리 채워진 채로
                  열려요. 엑셀에서 템플릿을 만드는 일을 여기서 딱 한 번만 하는 거예요.
                </Muted>
                <Button label="고정비 등록하러 가기" onPress={m.goFixed} />
              </Card>
            ) : null}

            <MyCard
              status={m.mine.status}
              progress={m.mine.progress}
              summary={m.mine.summary}
              busy={m.busy}
              onStart={m.start}
              onEdit={m.edit}
            />

            <ErrorText>{m.actionError}</ErrorText>

            <Card style={{ gap: space.md }}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>가족 진행 현황</Text>
                <Text
                  style={[
                    styles.badge,
                    m.book.book.status === 'COMPLETE' ? styles.badgeDone : styles.badgeOpen,
                  ]}
                >
                  {bookBadge(m.book.book.status, m.notSubmitted.length)}
                </Text>
              </View>

              <Divider />

              {m.members.map((member) => (
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

              {m.alone ? (
                <Muted>
                  아직 가족이 나뿐이에요. [가족] 탭에서 초대코드를 보내 함께 적어보세요.
                </Muted>
              ) : null}
            </Card>

            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>{formatYearMonth(m.yearMonth)} 요약</Text>

              {/*
                예전에는 전원이 제출해야 열렸다. 한 명이 앱을 안 쓰기 시작하면 그 달부터
                아무도 아무것도 못 보게 돼서 잠금을 없앴다. 대신 몇 명 기준인지 밝힌다.
              */}
              {m.submittedCount === 0 ? (
                <Muted>아직 아무도 적지 않았어요. 먼저 시작해보세요.</Muted>
              ) : (
                <>
                  {m.notSubmitted.length > 0 ? (
                    <Notice>
                      {m.notSubmitted.map((member) => member.displayName).join(', ')}님이 아직 안
                      적었어요 — 아래 숫자는 {m.submittedCount}명 기준이에요.
                    </Notice>
                  ) : (
                    <Muted>가족 모두가 기록을 마쳤어요.</Muted>
                  )}
                  <Button label="요약 보기" onPress={m.goSummary} />
                </>
              )}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
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

  content: {
    padding: t.space.lg,
    paddingTop: t.space.sm,
    gap: t.space.lg,
    paddingBottom: t.space.xxl,
  },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },

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
