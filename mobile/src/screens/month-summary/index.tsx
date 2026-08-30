import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import { bookKeys, fetchMonthSummary } from '@/entities/book';
import { useSession } from '@/entities/session';
import { colors, font, radius, space } from '@/shared/config/theme';
import { Button, Card, Divider, ErrorText, Loading, Muted, Notice, Row } from '@/shared/ui';
import { formatAmount, formatWon, formatYearMonth } from '@/shared/lib/format';

export default function SummaryScreen() {
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
          <Card style={{ gap: space.md }}>
            <ErrorText>
              {summary.error instanceof ApiError ? summary.error.message : '불러오지 못했어요.'}
            </ErrorText>
            <Button label="돌아가기" variant="ghost" onPress={() => router.back()} />
          </Card>
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
            </Card>

            {summary.data.changes.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <View style={{ gap: space.xs }}>
                  <Text style={styles.cardTitle}>이번 달 달라진 것</Text>
                  <Muted>이 줄들이 몇 달 뒤에 우리 집 살림의 패턴을 알려줘요.</Muted>
                </View>
                <Divider />
                {summary.data.changes.map((change, order) => (
                  <View key={`${change.displayName}-${change.name}-${order}`} style={{ gap: 2 }}>
                    <View style={styles.changeHead}>
                      <Text style={styles.changeName}>
                        {change.name}
                        <Text style={styles.changeWho}> · {change.displayName}</Text>
                      </Text>
                      <Text
                        style={[
                          styles.changeDelta,
                          { color: change.delta > 0 ? colors.up : colors.down },
                        ]}
                      >
                        {change.delta > 0 ? '+' : '−'}
                        {formatAmount(Math.abs(change.delta))}
                      </Text>
                    </View>
                    <Text style={styles.changeReason}>{change.reason}</Text>
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
                        <View style={[styles.barFill, { width: `${(item.amount / max) * 100}%` }]} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  back: { fontSize: 30, color: colors.inkSoft, lineHeight: 34, width: 24 },
  title: { ...font.bodyLg, fontWeight: '800', color: colors.ink },

  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },

  heroCard: { gap: space.md, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
  heroLabel: { ...font.small, fontWeight: '700', color: colors.primary },
  heroValue: { fontSize: 36, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },

  cardTitle: { ...font.bodyLg, fontWeight: '700', color: colors.ink },

  changeHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  changeName: { ...font.body, color: colors.ink, fontWeight: '600', flexShrink: 1 },
  changeWho: { ...font.small, color: colors.inkFaint, fontWeight: '400' },
  changeDelta: { ...font.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  changeReason: { ...font.small, color: colors.inkSoft },

  memberName: { ...font.body, fontWeight: '700', color: colors.ink, marginTop: space.xs },

  barTrack: { height: 6, backgroundColor: colors.surfaceMuted, borderRadius: radius.pill },
  barFill: { height: 6, backgroundColor: colors.primary, borderRadius: radius.pill },

  noteText: { ...font.body, color: colors.inkSoft },
});
