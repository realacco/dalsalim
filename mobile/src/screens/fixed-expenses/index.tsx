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
                    /*
                      라벨을 주지 않는다. 주면 안쪽 Text 들을 훑어 만들던 기본 라벨을 **대체**해서
                      스크린리더에서 분류와 금액이 사라진다. 지금 그대로 두면
                      "통신비, 통신 · 매월 25일, 55,000원" 이 읽히고, 옆의 × 는 자기 라벨이 있어 구분된다.
                    */
                    accessibilityRole="button"
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
                    containerStyle={styles.itemDeleteBox}
                    style={[styles.itemDelete, x.removing && styles.itemDeleteBusy]}
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
  /* 레이아웃은 바깥 컨테이너로. 안쪽에 주면 부모가 내용에 딱 붙어 터치 영역이 거기서 잘린다 */
  itemDeleteBox: { marginLeft: t.space.xs },
  /*
    크기를 고정하지 않고 padding 으로 잡는다. 고정하면 시스템 글꼴을 키웠을 때
    글리프만 커져서 박스를 넘어 잘린다. padding 이면 박스가 같이 커진다.
    손가락이 닿는 넓이도 이 padding 이 만든다 — hitSlop 은 부모 경계를 못 넘어 여기선 안 먹는다.
  */
  itemDelete: {
    padding: t.space.md,
    /*
      × 글리프가 가늘어 padding 만으로는 가로가 35dp 남짓이다. 안드로이드 권장 최소 48dp 를
      **하한**으로 준다 — 고정이 아니라서 글꼴을 키우면 padding 이 그 위로 더 넓힌다.
    */
    minWidth: t.space.xxl + t.space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Button 과 달리 PressableScale 은 disabled 로 안 흐려진다. 안 흐리면 "눌러도 반응 없음"으로 보인다 */
  itemDeleteBusy: { opacity: t.opacity.disabled },
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
