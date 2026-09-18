import { useEffect, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  MONTH_END_HINT,
  SETTLEMENT_DAYS,
  SETTLEMENT_DAY_LABELS,
  SETTLEMENT_TIMES,
  SETTLEMENT_TIME_LABELS,
  formatSettlement,
  settlesOnDragEnd,
  stepIndex,
  timeIndex,
  wheelIndex,
  wheelMetrics,
} from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import type { Settlement } from '@/shared/model/types';
import { Button, ErrorText, Muted, Sheet } from '@/shared/ui';

/**
 * 칸 높이와 보이는 칸 수는 **시스템 글자 배율을 따라 달라진다** — 계산은 `wheelMetrics()`(entities).
 * 스냅 간격 · `scrollTo` · 띠 위치 · 칸 높이가 **전부 같은 값**을 봐야 해서 한 곳에서 받아 내려보낸다.
 * 한 군데만 딴 값을 보면 굴린 자리와 고른 값이 조용히 어긋난다.
 */
type Metrics = ReturnType<typeof wheelMetrics>;

/** 스크린리더의 위/아래 조절. 배열을 매 렌더 새로 만들면 프롭이 계속 바뀐다 */
const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const;

/**
 * 정산일을 고르는 아래 시트. draft 가 없으면 닫혀 있다.
 * 굴리기만 하고 적는 칸이 없어서 배경을 눌러 닫아도 잃을 것이 없다 (`dismissOnBackdrop`).
 *
 * 날짜 31개 · 시각 48개를 칩으로 깔면 판이 화면을 넘는다. 알람을 맞추던 손 그대로,
 * **두 칸을 굴려 한 번에** 정한다 (실사용 후기 2026-09-17 — 「고르는 데 손이 많이 간다」).
 */
export function SettlementSheet({
  draft,
  error,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  draft: Settlement | null;
  error: string | null;
  saving: boolean;
  onChange: (patch: Partial<Settlement>) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { font, size, space } = useTheme();
  const insets = useSafeAreaInsets();
  // 글자 배율은 앱이 떠 있는 동안에도 바뀔 수 있다 — 훅으로 받아야 따라온다
  const { fontScale } = useWindowDimensions();
  const metrics = wheelMetrics(fontScale, {
    touchSize: size.touch,
    selectedLineHeight: font.title.lineHeight,
    padding: space.sm,
  });

  return (
    <Sheet visible={draft !== null} onClose={onClose} title="정산일" dismissOnBackdrop>
      {draft ? (
        <View style={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.preview}>{formatSettlement(draft)}</Text>
          <Muted>{MONTH_END_HINT}</Muted>

          {/*
            가운데 띠는 휠 **뒤에** 깔고 손가락은 통과시킨다 — 위에 덮으면 띠가 스크롤을 먹는다.
            띠 하나로 두 칸을 같이 지나가므로 둘이 어긋나 보일 일도 없다.
          */}
          <View style={[styles.wheels, { height: metrics.itemHeight * metrics.visible }]}>
            <View
              style={[styles.band, { top: metrics.padOffset, height: metrics.itemHeight }]}
              pointerEvents="none"
            />
            <Wheel
              label="날짜"
              items={SETTLEMENT_DAY_LABELS}
              index={draft.day - 1}
              metrics={metrics}
              onSelect={(index) => onChange({ day: SETTLEMENT_DAYS[index] })}
            />
            <Wheel
              label="시각"
              items={SETTLEMENT_TIME_LABELS}
              index={timeIndex(draft.hour, draft.minute)}
              metrics={metrics}
              onSelect={(index) => onChange(SETTLEMENT_TIMES[index])}
            />
          </View>

          <Muted>30분 단위로 고를 수 있어요.</Muted>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button label="저장" loading={saving} onPress={onSave} />
        </View>
      ) : null}
    </Sheet>
  );
}

/**
 * 굴려서 고르는 한 칸. 스냅은 `ScrollView` 가 하고, 멈춘 자리를 칸 번호로 바꾸는 계산은
 * `wheelIndex()`(entities)가 한다 — 여기는 그리기만 한다.
 *
 * 처음 위치는 `onLayout` 에서 한 번만 맞춘다. 렌더 직후의 `scrollTo` 는 아직 높이를 모르는 채라
 * 안 먹고, `index` 가 바뀔 때마다 맞추면 손가락으로 굴리는 중에 되돌려 놓는 싸움이 난다.
 */
function Wheel({
  label,
  items,
  index,
  metrics,
  onSelect,
}: {
  label: string;
  items: string[];
  index: number;
  metrics: Metrics;
  onSelect: (index: number) => void;
}) {
  const styles = useStyles();
  const scroll = useRef<ScrollView>(null);
  /**
   * 마지막으로 정렬을 놓을 때 쓴 칸 높이. boolean 으로 「놓았다」만 기억하면, 시트가 열려
   * 있는 동안 글자 배율이 바뀌었을 때 스크롤 위치만 옛 높이에 남아 띠와 어긋난다.
   * 0 은 「아직 한 번도 안 놓았다」 — 첫 배치는 `onLayout` 이 맡는다.
   */
  const placedAt = useRef(0);

  /**
   * 배율이 바뀐 뒤의 **재배치**는 효과가 맡는다. `onLayout` 에만 맡길 수 없다 —
   * 그것은 프레임이 바뀔 때만 오는데, 칸이 커지면 보이는 칸을 줄이므로
   * **판 높이가 같아지는 배율 짝**(48×5 = 80×3 = 240)이 실제로 있다. 그 사이로 배율이
   * 바뀌면 칸 높이는 달라졌는데 `onLayout` 이 안 와서 옛 자리에 그대로 남는다.
   * `index` 는 의존성에 넣지 않는다 — 굴리는 중에 되돌려 놓는 싸움이 난다.
   */
  useEffect(() => {
    if (placedAt.current === 0 || placedAt.current === metrics.itemHeight) return;
    placedAt.current = metrics.itemHeight;
    scroll.current?.scrollTo({ y: index * metrics.itemHeight, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metrics.itemHeight]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = wheelIndex(event.nativeEvent.contentOffset.y, metrics.itemHeight, items.length);
    if (next !== index) onSelect(next);
  };

  return (
    <ScrollView
      ref={scroll}
      style={styles.wheel}
      // 스크린리더가 굴리는 중에도 「지금 고른 값」을 읽을 수 있어야 한다 — 미리보기 글자는 초점 밖이다.
      // ScrollView 는 기본적으로 초점 대상이 아니라 안쪽 Text 들이 하나씩 잡히므로,
      // accessible 로 한 덩어리로 묶고 「굴려서 값을 고르는 것」이라고 역할을 준다
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: items[index] }}
      // `adjustable` 은 이 둘과 짝일 때만 성립한다. 선언만 두면 스크린리더의 위/아래 조절이
      // 네이티브 스크롤을 가로챈 채 아무 일도 하지 않아, 읽기만 되고 못 바꾸는 컨트롤이 된다
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={(event) => {
        const step = event.nativeEvent.actionName === 'increment' ? 1 : -1;
        const next = stepIndex(index, step, items.length);
        if (next === index) return;
        // 이 경로에는 스크롤 이벤트가 오지 않아 휠이 저절로 따라오지 않는다
        scroll.current?.scrollTo({ y: next * metrics.itemHeight, animated: false });
        onSelect(next);
      }}
      showsVerticalScrollIndicator={false}
      snapToInterval={metrics.itemHeight}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: metrics.padOffset }}
      onLayout={() => {
        if (placedAt.current === metrics.itemHeight) return;
        placedAt.current = metrics.itemHeight;
        scroll.current?.scrollTo({ y: index * metrics.itemHeight, animated: false });
      }}
      onMomentumScrollEnd={settle}
      // 튕겨 놓았으면 아직 날아가는 중이라 멈출 때까지 기다린다 — 판정은 settlesOnDragEnd()
      onScrollEndDrag={(event) => {
        if (settlesOnDragEnd(event.nativeEvent.velocity?.y)) settle(event);
      }}
    >
      {items.map((item, itemIndex) => (
        <View key={item} style={[styles.item, { height: metrics.itemHeight }]}>
          <Text
            style={[styles.itemLabel, itemIndex === index && styles.itemLabelSelected]}
            numberOfLines={1}
            // 칸 높이는 wheelMetrics 가 키워 막고, 폭은 이 둘이 막는다 —
            // 큰 글자에서 "오전 12:00" 이 두 칸 폭(≈156dp)을 넘어 잘린다
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {item}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: t.space.xl, gap: t.space.md },
  preview: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.primary },

  // 높이는 글자 배율을 타므로 인라인으로 준다 (makeStyles 는 배율을 모른다)
  wheels: { flexDirection: 'row' },
  /** 고른 값이 서는 자리. 가운데 한 칸 */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primarySoft,
  },
  wheel: { flex: 1 },
  item: { alignItems: 'center', justifyContent: 'center' },
  itemLabel: { ...t.font.bodyLg, color: t.colors.inkFaint },
  // 가운데 칸만 진하다 — 띠 색과 함께 「이게 고른 값」을 두 번 말한다
  itemLabelSelected: { ...t.font.title, fontWeight: t.weight.bold, color: t.colors.ink },
}));
