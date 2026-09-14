// 기능: F-BOOK-02 F-ENT-11
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bookKeys, fetchMonthSummary } from '@/entities/book';
import { formatSettlementDelta } from '@/entities/entry';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Loading, Muted, Notice, QueryError, Row } from '@/shared/ui';
import { formatAmount, formatWon, formatYearMonth } from '@/shared/lib/format';
import { MESSAGES } from '@/shared/config/messages';

export default function SummaryScreen() {
  const styles = useStyles();
  const { colors, space } = useTheme();
  const router = useRouter();
  const familyId = useSession((state) => state.familyId);
  const { yearMonth } = useLocalSearchParams<{ yearMonth: string }>();

  const summary = useQuery({
    queryKey: bookKeys.summary(familyId, yearMonth as string),
    queryFn: () => fetchMonthSummary(familyId as string, yearMonth as string),
    enabled: Boolean(familyId && yearMonth),
  });

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{formatYearMonth(yearMonth ?? '')} 요약</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {summary.isLoading ? <Loading /> : null}

        {summary.isError ? (
          <QueryError error={summary.error} onRetry={() => void summary.refetch()} />
        ) : null}

        {summary.data && summary.data.progress.submittedCount === 0 ? (
          <Card style={{ gap: space.md }}>
            <Text style={styles.cardTitle}>아직 아무도 적지 않았어요</Text>
            <Muted>이 달의 기록이 하나도 없어서 보여줄 숫자가 없어요.</Muted>
            <Button label="돌아가기" variant="ghost" onPress={() => router.back()} />
          </Card>
        ) : null}

        {summary.data && summary.data.progress.submittedCount > 0 ? (
          <>
            {/* 미제출자가 있어도 요약은 열린다. 대신 아래 숫자가 몇 명 기준인지 먼저 밝힌다. */}
            {summary.data.progress.pendingMembers.length > 0 ? (
              <Notice>
                {summary.data.progress.pendingMembers.map((m) => m.displayName).join(', ')}님이 아직
                안 적었어요 — 아래 숫자는 {summary.data.progress.submittedCount}명 기준이에요.
              </Notice>
            ) : null}

            <Card style={styles.heroCard}>
              <Text style={styles.heroLabel}>남은 돈</Text>
              <Text style={styles.heroValue}>{formatWon(summary.data.totals.surplus)}</Text>
              <Divider />
              <Row label="수입" value={formatWon(summary.data.totals.income)} />
              <Row label="고정비" value={`− ${formatWon(summary.data.totals.fixedTotal)}`} />
              <Row label="추가 지출" value={`− ${formatWon(summary.data.totals.extraTotal)}`} />
              {summary.data.totals.settlementTotal > 0 ? (
                <Row
                  label={MESSAGES.settlementRow}
                  value={`− ${formatWon(summary.data.totals.settlementTotal)}`}
                />
              ) : null}
            </Card>

            {summary.data.changes.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <View style={{ gap: space.xs }}>
                  <Text style={styles.cardTitle}>이번 달 달라진 것</Text>
                  <Muted>이 줄들이 몇 달 뒤에 우리 집 살림의 패턴을 알려줘요.</Muted>
                </View>
                <Divider />
                {summary.data.changes.map((change, order) => (
                  <View
                    key={`${change.displayName}-${change.name}-${order}`}
                    style={{ gap: space.xxs }}
                  >
                    <View style={styles.deltaHead}>
                      <Text style={styles.deltaName}>
                        {change.name}
                        <Text style={styles.deltaWho}> · {change.displayName}</Text>
                      </Text>
                      <Text
                        style={[
                          styles.deltaAmount,
                          { color: change.delta > 0 ? colors.up : colors.down },
                        ]}
                      >
                        {change.delta > 0 ? '+' : '−'}
                        {formatAmount(Math.abs(change.delta))}
                      </Text>
                    </View>
                    <Text style={styles.deltaNote}>{change.reason}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            {summary.data.settlements.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <View style={{ gap: space.xs }}>
                  <Text style={styles.cardTitle}>지난달 결산</Text>
                  <Muted>
                    옮겨둔 돈을 실제로 얼마나 썼는지예요. 더 쓴 만큼만 남은 돈에서 빠져요.
                  </Muted>
                </View>
                <Divider />
                {summary.data.settlements.map((item, order) => (
                  <View
                    key={`${item.displayName}-${item.name}-${order}`}
                    style={{ gap: space.xxs }}
                  >
                    <View style={styles.deltaHead}>
                      <Text style={styles.deltaName}>
                        {item.name}
                        <Text style={styles.deltaWho}> · {item.displayName}</Text>
                      </Text>
                      {/* 덜 쓴 것은 색을 입히지 않는다 — 남은 돈이 늘지 않으니 "좋은 일" 로 읽히면 안 된다 */}
                      <Text
                        style={[
                          styles.deltaAmount,
                          { color: item.delta > 0 ? colors.up : colors.inkFaint },
                        ]}
                      >
                        {formatSettlementDelta(item.delta)}
                      </Text>
                    </View>
                    <Text style={styles.deltaNote}>
                      {formatWon(item.planned)} 옮기고 {formatWon(item.actual)} 썼어요
                    </Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>사람별</Text>
              <Divider />
              {summary.data.perMember.map((member) => (
                <View key={member.membershipId} style={{ gap: space.xs }}>
                  <Text style={styles.memberName}>
                    {member.displayName}
                    {/* 미제출자는 0원으로 서 있다. 그걸 "안 썼다"로 오해하면 안 된다. */}
                    {member.submitted ? '' : ' · 아직 안 적었어요'}
                  </Text>
                  <Row label="수입" value={formatWon(member.income)} />
                  <Row
                    label="지출"
                    value={`− ${formatWon(member.fixedTotal + member.extraTotal)}`}
                  />
                  {/* 남은 돈이 이 줄까지 뺀 값이라, 없으면 수입 − 지출 ≠ 남은 돈으로 보인다 (F-ENT-11) */}
                  {member.settlementTotal > 0 ? (
                    <Row
                      label={MESSAGES.settlementRow}
                      value={`− ${formatWon(member.settlementTotal)}`}
                    />
                  ) : null}
                  <Row
                    label="남은 돈"
                    value={formatWon(member.surplus)}
                    tone={member.surplus < 0 ? 'up' : 'down'}
                  />
                </View>
              ))}
            </Card>

            {summary.data.byCategory.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>분류별 지출</Text>
                <Divider />
                {summary.data.byCategory.map((item) => {
                  const max = summary.data.byCategory[0]?.amount || 1;
                  return (
                    <View key={item.category} style={{ gap: space.xs }}>
                      <Row label={item.category} value={formatWon(item.amount)} />
                      <View style={styles.barTrack}>
                        <View
                          style={[styles.barFill, { width: `${(item.amount / max) * 100}%` }]}
                        />
                      </View>
                    </View>
                  );
                })}
              </Card>
            ) : null}

            {summary.data.extras.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>이번 달 추가 지출</Text>
                <Divider />
                {summary.data.extras.map((extra, order) => (
                  <Row
                    key={`${extra.name}-${order}`}
                    label={`${extra.name} · ${extra.displayName}`}
                    value={formatWon(extra.amount)}
                  />
                ))}
              </Card>
            ) : null}

            {summary.data.notes.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>이번 달 특이사항</Text>
                <Divider />
                {summary.data.notes.map((note, order) => (
                  <View key={`${note.displayName}-${order}`} style={{ gap: space.xs }}>
                    <Text style={styles.memberName}>{note.displayName}</Text>
                    <Text style={styles.noteText}>{note.note}</Text>
                  </View>
                ))}
              </Card>
            ) : null}

            <Muted style={{ textAlign: 'center' }}>
              [추이] 탭에서 달마다 어떻게 달라졌는지 볼 수 있어요.
            </Muted>
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
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
  },
  back: { ...t.font.glyph, color: t.colors.inkSoft, width: 24 },
  title: { ...t.font.bodyLg, fontWeight: t.weight.heavy, color: t.colors.ink },

  content: { padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxl },

  heroCard: {
    gap: t.space.md,
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primarySoft,
  },
  heroLabel: { ...t.font.small, fontWeight: t.weight.bold, color: t.colors.primary },
  heroValue: { ...t.font.amount, fontWeight: t.weight.heavy, color: t.colors.ink },

  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },

  deltaHead: { flexDirection: 'row', justifyContent: 'space-between', gap: t.space.md },
  deltaName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold, flexShrink: 1 },
  deltaWho: { ...t.font.small, color: t.colors.inkFaint, fontWeight: t.weight.regular },
  deltaAmount: {
    ...t.font.body,
    fontWeight: t.weight.bold,
    fontVariant: ['tabular-nums' as const],
  },
  deltaNote: { ...t.font.small, color: t.colors.inkSoft },

  memberName: {
    ...t.font.body,
    fontWeight: t.weight.bold,
    color: t.colors.ink,
    marginTop: t.space.xs,
  },

  barTrack: { height: 6, backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.pill },
  barFill: { height: 6, backgroundColor: t.colors.primary, borderRadius: t.radius.pill },

  noteText: { ...t.font.body, color: t.colors.inkSoft },
}));
