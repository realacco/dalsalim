import { useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PixelRatio,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SETTLEMENT_DAYS,
  SETTLEMENT_TIMES,
  formatSettlement,
  formatTime,
  MONTH_END_HINT,
  timeIndex,
  wheelIndex,
  wheelMetrics,
} from '@/entities/family';
import { size } from '@/shared/config/theme';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import type { Settlement } from '@/shared/model/types';
import { Button, ErrorText, Muted, Sheet } from '@/shared/ui';

/**
 * 칸 높이와 보이는 칸 수는 **시스템 글자 배율을 따라 달라진다** — 계산은 `wheelMetrics()`(entities).
 * 스냅 간격 · `scrollTo` · 띠 위치 · 칸 높이가 **전부 같은 값**을 봐야 해서 한 곳에서 받아 내려보낸다.
 * 한 군데만 딴 값을 보면 굴린 자리와 고른 값이 조용히 어긋난다.
 */
type Metrics = { itemHeight: number; visible: number };

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
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const metrics = wheelMetrics(PixelRatio.getFontScale(), size.touch);
  const bandOffset = metrics.itemHeight * ((metrics.visible - 1) / 2);

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
              style={[styles.band, { top: bandOffset, height: metrics.itemHeight }]}
              pointerEvents="none"
            />
            <Wheel
              label="날짜"
              items={SETTLEMENT_DAYS.map((day) => `${day}일`)}
              index={draft.day - 1}
              metrics={metrics}
              onSelect={(index) => onChange({ day: SETTLEMENT_DAYS[index] })}
            />
            <Wheel
              label="시각"
              items={SETTLEMENT_TIMES.map((time) => formatTime(time.hour, time.minute))}
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
  const placed = useRef(false);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = wheelIndex(event.nativeEvent.contentOffset.y, metrics.itemHeight, items.length);
    if (next !== index) onSelect(next);
  };

  return (
    <ScrollView
      ref={scroll}
      style={styles.wheel}
      accessibilityLabel={label}
      // 스크린리더가 굴리는 중에도 「지금 고른 값」을 읽을 수 있어야 한다 — 미리보기 글자는 초점 밖이다
      accessibilityValue={{ text: items[index] }}
      showsVerticalScrollIndicator={false}
      snapToInterval={metrics.itemHeight}
      decelerationRate="fast"
      contentContainerStyle={{ paddingVertical: metrics.itemHeight * ((metrics.visible - 1) / 2) }}
      onLayout={() => {
        if (placed.current) return;
        placed.current = true;
        scroll.current?.scrollTo({ y: index * metrics.itemHeight, animated: false });
      }}
      // 손가락으로 굴린 것과 튕겨서 멈춘 것, 둘 다 「고른 것」이다
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
    >
      {items.map((item, itemIndex) => (
        <View key={item} style={[styles.item, { height: metrics.itemHeight }]}>
          <Text
            style={[styles.itemLabel, itemIndex === index && styles.itemLabelSelected]}
            numberOfLines={1}
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
