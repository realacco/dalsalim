// 기능: F-FIX-01 F-FIX-02 F-FIX-03 F-FIX-04
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Loading, Muted, PressableScale, QueryError } from '@/shared/ui';
import { formatWon } from '@/shared/lib/format';
import { confirm } from '@/shared/lib/confirm';

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
                <View key={item.id} style={styles.item}>
                  <Pressable
                    onPress={() => x.openEdit(item, group.membershipId)}
                    style={styles.itemMain}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 수정`}
                  >
                    <View style={{ flex: 1, gap: space.xxs }}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        {item.category}
                        {item.dayOfMonth ? ` · 매월 ${item.dayOfMonth}일` : ''}
                      </Text>
                    </View>
                    <Text style={styles.itemAmount}>{formatWon(item.defaultAmount)}</Text>
                  </Pressable>

                  {/*
                    지우기를 여기 두는 이유: 이것 하나 하려고 시트를 열고 맨 아래까지
                    내려가야 했다 (실사용 후기 2026-09-07). 시트의 [이 항목 지우기] 는
                    그대로 둔다 — 스크린리더나 좁은 화면에서 여기를 못 찾아도 길이 남아야 한다.
                  */}
                  <PressableScale
                    small
                    disabled={x.removing}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} 지우기`}
                    hitSlop={space.sm}
                    style={styles.itemDelete}
                    onPress={() =>
                      confirm({
                        title: `${item.name} 지우기`,
                        body: '앞으로의 기록에서 빠져요. 지난 기록은 그대로 남아요.',
                        confirmLabel: '지우기',
                        destructive: true,
                        onConfirm: () => x.removeItem(item.id),
                      })
                    }
                  >
                    <Text style={styles.itemDeleteGlyph}>×</Text>
                  </PressableScale>
                </View>
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

  item: { flexDirection: 'row', alignItems: 'center' },
  /* 행을 눌러 여는 영역. 지우기는 이 바깥에 있어야 눌림이 안 겹친다 */
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.space.sm,
    gap: t.space.md,
  },
  /*
    폭 360dp 에서 이만큼을 금액 오른쪽에 내준다. 이름 칸(flex:1)이 그만큼 좁아져
    긴 이름은 두 줄로 감기지만, 잘리지는 않는다.
  */
  itemDelete: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: t.space.xs,
  },
  /* 목록을 훑을 때 눈에 먼저 걸리면 안 된다 — 주인공은 이름과 금액이다 */
  itemDeleteGlyph: { ...t.font.title, color: t.colors.inkFaint },
  itemName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  itemMeta: { ...t.font.caption, color: t.colors.inkFaint },
  itemAmount: {
    ...t.font.body,
    color: t.colors.ink,
    fontWeight: t.weight.bold,
    fontVariant: ['tabular-nums' as const],
  },
}));
