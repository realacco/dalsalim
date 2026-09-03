import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Loading, Muted, QueryError } from '@/shared/ui';
import { formatWon } from '@/shared/lib/format';

import { useFixedExpenses } from './model/use-fixed-expenses';
import { FixedExpenseSheet } from './ui/fixed-expense-sheet';

/**
 * 고정비 화면 — 사람별 목록과 합계. 편집은 아래 시트(ui/fixed-expense-sheet)가 맡는다.
 * 상태와 서버 통신은 useFixedExpenses 에, 검사·변환 규칙은 model/draft 에 있다.
 */
export default function FixedScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const x = useFixedExpenses();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>고정비</Text>
        <Muted>매달 나가는 돈을 사람별로 등록해두면, 기록할 때 자동으로 물어봐요.</Muted>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={x.isFetching} onRefresh={x.refetch} />}
      >
        {x.isLoading ? <Loading /> : null}
        {x.isError ? <QueryError error={x.error} onRetry={x.refetch} /> : null}

        {x.loaded ? (
          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>우리 가족 고정비 합계</Text>
            <Text style={styles.totalValue}>{formatWon(x.total)}</Text>
            <Muted>매달 이만큼은 이미 나갈 예정이에요.</Muted>
          </Card>
        ) : null}

        {x.groups.map((group) => (
          <Card key={group.membershipId} style={{ gap: space.md }}>
            <View style={styles.groupHead}>
              <Text style={styles.groupName}>
                {group.displayName}
                {group.isMe ? ' (나)' : ''}
              </Text>
              <Text style={styles.groupTotal}>{formatWon(group.monthlyTotal)}</Text>
            </View>

            <Divider />

            {group.items.length === 0 ? (
              <Muted>아직 등록한 고정비가 없어요.</Muted>
            ) : (
              group.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => x.openEdit(item, group.membershipId)}
                  style={styles.item}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category}
                      {item.dayOfMonth ? ` · 매월 ${item.dayOfMonth}일` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatWon(item.defaultAmount)}</Text>
                </Pressable>
              ))
            )}

            <Button
              label="+ 항목 추가"
              variant="ghost"
              onPress={() => x.openNew(group.membershipId)}
            />
          </Card>
        ))}
      </ScrollView>

      <FixedExpenseSheet
        draft={x.draft}
        error={x.draftError}
        saving={x.saving}
        onChange={x.change}
        onSave={x.submit}
        onRemove={x.removeCurrent}
        onClose={x.close}
      />
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

  totalCard: {
    backgroundColor: t.colors.primarySoft,
    borderColor: t.colors.primarySoft,
    gap: t.space.xs,
  },
  totalLabel: { ...t.font.small, color: t.colors.primary, fontWeight: t.weight.bold },
  totalValue: { ...t.font.question, fontWeight: t.weight.heavy, color: t.colors.ink },

  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  groupName: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  groupTotal: { ...t.font.body, color: t.colors.inkSoft, fontVariant: ['tabular-nums' as const] },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.space.sm,
    gap: t.space.md,
  },
  itemName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  itemMeta: { ...t.font.caption, color: t.colors.inkFaint },
  itemAmount: {
    ...t.font.body,
    color: t.colors.ink,
    fontWeight: t.weight.bold,
    fontVariant: ['tabular-nums' as const],
  },
}));
