import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { bookKeys, fetchTrend } from '@/entities/book';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Card, Divider, Loading, Muted, Notice, QueryError } from '@/shared/ui';
import { formatWon, formatYearMonth } from '@/shared/lib/format';

import { TrendChart } from './ui/trend-chart';

const MONTHS = 12;

/**
 * 추이 — 엑셀에서 못 하던 것이 아니라, 하려면 시트를 다 뒤져야 했던 것이다. (기획서 7.5)
 * 두 번째 달부터 의미가 생긴다. 첫 달에 비어 있는 건 정상이다.
 */
export default function TrendScreen() {
  const styles = useStyles();
  const { colors, space } = useTheme();
  const router = useRouter();
  const familyId = useSession((state) => state.familyId);

  const trend = useQuery({
    queryKey: bookKeys.trend(familyId, MONTHS),
    queryFn: () => fetchTrend(familyId as string, MONTHS),
    enabled: Boolean(familyId),
  });

  const points = trend.data ?? [];
  const partial = points.filter((p) => p.submittedCount < p.memberCount);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>추이</Text>
        <Muted>매달 어떻게 달라졌는지 한눈에 봐요.</Muted>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={trend.isFetching} onRefresh={() => void trend.refetch()} />
        }
      >
        {trend.isLoading ? <Loading /> : null}

        {trend.isError ? (
          <QueryError error={trend.error} onRetry={() => void trend.refetch()} />
        ) : null}

        {trend.data && points.length < 2 ? (
          <Card style={{ gap: space.sm }}>
            <Text style={styles.cardTitle}>두 달째부터 추이가 보여요</Text>
            <Muted>
              {points.length === 0
                ? '아직 제출된 기록이 없어요. 이번 달을 먼저 적어보세요.'
                : '이번 달 하나로는 비교할 대상이 없어요. 다음 달에 다시 와보세요.'}
            </Muted>
          </Card>
        ) : null}

        {points.length >= 2 ? (
          <>
            <Card style={{ gap: space.lg }}>
              <TrendChart points={points} />
            </Card>

            {partial.length > 0 ? (
              <Notice>
                일부 달은 가족 전원이 적지 않았어요. 그 달은 적은 사람 것만 세고 있어요.
              </Notice>
            ) : null}

            <Card style={{ gap: space.md }}>
              <Text style={styles.cardTitle}>월별</Text>
              <Divider />
              {[...points].reverse().map((point) => (
                <Pressable
                  key={point.yearMonth}
                  onPress={() => router.push(`/summary/${point.yearMonth}`)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatYearMonth(point.yearMonth)} 요약 보기`}
                >
                  <View style={{ gap: 2 }}>
                    <Text style={styles.month}>{formatYearMonth(point.yearMonth)}</Text>
                    <Text style={styles.meta}>
                      {point.submittedCount === point.memberCount
                        ? '전원 기록'
                        : `${point.submittedCount}/${point.memberCount}명 기록`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text
                      style={[
                        styles.surplus,
                        { color: point.surplus < 0 ? colors.up : colors.ink },
                      ]}
                    >
                      {formatWon(point.surplus)}
                    </Text>
                    <Text style={styles.meta}>수입 {formatWon(point.income)}</Text>
                  </View>
                </Pressable>
              ))}
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
    paddingHorizontal: t.space.lg,
    paddingTop: t.space.md,
    paddingBottom: t.space.sm,
    gap: t.space.xs,
  },
  title: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink },
  content: {
    padding: t.space.lg,
    paddingTop: t.space.sm,
    gap: t.space.lg,
    paddingBottom: t.space.xxl,
  },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: t.space.sm,
    gap: t.space.md,
  },
  month: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  meta: { ...t.font.caption, color: t.colors.inkFaint },
  surplus: { ...t.font.bodyLg, fontWeight: t.weight.bold, fontVariant: ['tabular-nums' as const] },
}));
