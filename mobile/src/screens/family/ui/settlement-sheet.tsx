import { useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
  shortMonthHint,
  timeIndex,
  wheelIndex,
} from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import type { Settlement } from '@/shared/model/types';
import { Button, ErrorText, Muted, Sheet } from '@/shared/ui';

/** 한 칸의 높이. 터치 최소 크기와 같다 — 굴리다 멈춘 칸이 곧 누를 수 있는 크기다 */
const ITEM_HEIGHT = 44;
/** 위아래로 두 칸씩 보인다. 가운데가 고른 값이고, 이웃이 보여야 굴릴 수 있다는 게 읽힌다 */
const VISIBLE = 5;

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
  const hint = draft ? shortMonthHint(draft.day) : null;

  return (
    <Sheet visible={draft !== null} onClose={onClose} title="정산일" dismissOnBackdrop>
      {draft ? (
        <View style={[styles.content, { paddingBottom: insets.bottom + space.lg }]}>
          <Text style={styles.preview}>{formatSettlement(draft)}</Text>
          {hint ? <Muted>{hint}</Muted> : null}

          {/*
            가운데 띠는 휠 **뒤에** 깔고 손가락은 통과시킨다 — 위에 덮으면 띠가 스크롤을 먹는다.
            띠 하나로 두 칸을 같이 지나가므로 둘이 어긋나 보일 일도 없다.
          */}
          <View style={styles.wheels}>
            <View style={styles.band} pointerEvents="none" />
            <Wheel
              label="날짜"
              items={SETTLEMENT_DAYS.map((day) => `${day}일`)}
              index={draft.day - 1}
              onSelect={(index) => onChange({ day: SETTLEMENT_DAYS[index] })}
            />
            <Wheel
              label="시각"
              items={SETTLEMENT_TIMES.map((time) => formatTime(time.hour, time.minute))}
              index={timeIndex(draft.hour, draft.minute)}
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
  onSelect,
}: {
  label: string;
  items: string[];
  index: number;
  onSelect: (index: number) => void;
}) {
  const styles = useStyles();
  const scroll = useRef<ScrollView>(null);
  const placed = useRef(false);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = wheelIndex(event.nativeEvent.contentOffset.y, ITEM_HEIGHT, items.length);
    if (next !== index) onSelect(next);
  };

  return (
    <ScrollView
      ref={scroll}
      style={styles.wheel}
      accessibilityLabel={label}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      contentContainerStyle={styles.wheelContent}
      onLayout={() => {
        if (placed.current) return;
        placed.current = true;
        scroll.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: false });
      }}
      // 손가락으로 굴린 것과 튕겨서 멈춘 것, 둘 다 「고른 것」이다
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
    >
      {items.map((item, itemIndex) => (
        <View key={item} style={styles.item}>
          <Text
            style={[styles.itemLabel, itemIndex === index && styles.itemLabelSelected]}
            numberOfLines={1}
            // 칸 높이가 고정이라 큰 글자에서 글자가 잘리는 대신 줄어들게 둔다
            adjustsFontSizeToFit
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

  wheels: { flexDirection: 'row', height: ITEM_HEIGHT * VISIBLE, justifyContent: 'center' },
  /** 고른 값이 서는 자리. 가운데 한 칸 */
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: ITEM_HEIGHT * ((VISIBLE - 1) / 2),
    height: ITEM_HEIGHT,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primarySoft,
  },
  wheel: { flex: 1 },
  /** 위아래 두 칸만큼 비워야 첫 칸과 끝 칸도 가운데까지 올라온다 */
  wheelContent: { paddingVertical: ITEM_HEIGHT * ((VISIBLE - 1) / 2) },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { ...t.font.bodyLg, color: t.colors.inkFaint },
  // 가운데 칸만 진하다 — 띠 색과 함께 「이게 고른 값」을 두 번 말한다
  itemLabelSelected: { ...t.font.title, fontWeight: t.weight.bold, color: t.colors.ink },
}));
