import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SETTLEMENT_DAY_ROWS,
  SETTLEMENT_TIME_PRESETS,
  formatPreset,
  formatSettlement,
  formatTime,
  shortMonthHint,
  stepTime,
} from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import type { Settlement } from '@/shared/model/types';
import { Button, Chip, ErrorText, Muted, PressableScale, useSheetDrag } from '@/shared/ui';

/**
 * 정산일을 고르는 아래 시트. draft 가 없으면 닫혀 있다.
 * 입력창이 없어 키보드 회피는 없다 — 칩만 누른다. (고정비 시트보다 가볍게 둔 이유)
 *
 * 끌어내려 닫는 것은 고정비·계산기 시트와 **같은 배관**(`useSheetDrag`)을 쓴다.
 * 알약은 이 앱에서 손잡이라, 다른 시트는 끌리는데 여기만 안 끌리면 고장으로 읽힌다.
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
  const { translateY, drag } = useSheetDrag(draft !== null, onClose);
  const hint = draft ? shortMonthHint(draft.day) : null;

  return (
    <Modal visible={draft !== null} animationType="slide" transparent onRequestClose={onClose}>
      {/* ⚠️ Modal 은 별도의 네이티브 창이라 제스처 뿌리를 이 안에 한 번 더 심어야 끌기가 돈다 */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.backdropWrap}>
          <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/*
              잡는 영역은 알약(40x4)이 아니라 **제목까지 포함한 머리 전체**다 — 4dp 짜리를
              정확히 짚으라고 할 수 없다. 제스처를 여기에만 걸어야 안쪽 칩 스크롤과 안 싸운다.
              (고정비 시트와 같은 모양)
            */}
            <GestureDetector gesture={drag}>
              <View style={styles.header}>
                <View style={styles.grabber} />
                <Text style={styles.title}>정산일</Text>
              </View>
            </GestureDetector>
            {/*
              큰 글자 설정에서는 화면을 넘을 수 있다 — 뚜껑을 두고 안에서 스크롤 (저장 버튼이 잘리면 기능이 막힌다).
              칩 57개를 깔던 때(날짜 31 · 시 24 · 분 2)는 기본 글자에서도 넘쳤다 — 그게 「고르는 데 손이 많이 간다」
              의 절반이었다 (실사용 후기 2026-09-17)
            */}
            {draft ? (
              /*
                좌우·아래 여백은 시트가 아니라 contentContainerStyle 에 준다. 시트에 패딩을 주면
                ScrollView 가 그만큼 안쪽에 놓여서 스크롤바가 화면 끝이 아니라 칩 위에 그려진다.
                (고정비 시트와 같은 이유 — `fixed-expense-sheet.tsx`)
              */
              <ScrollView
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: insets.bottom + space.lg },
                ]}
              >
                <Text style={styles.preview}>{formatSettlement(draft)}</Text>
                {hint ? <Muted>{hint}</Muted> : null}

                <Text style={styles.label}>날짜</Text>
                <View style={styles.grid}>
                  {SETTLEMENT_DAY_ROWS.map((row, index) => (
                    <View key={index} style={styles.gridRow}>
                      {row.map((day, col) =>
                        day === null ? (
                          <View key={`empty-${col}`} style={styles.cellSlot} />
                        ) : (
                          <PressableScale
                            key={day}
                            small
                            accessibilityRole="button"
                            accessibilityLabel={`${day}일`}
                            accessibilityState={{ selected: draft.day === day }}
                            onPress={() => onChange({ day })}
                            containerStyle={styles.cellSlot}
                            style={[styles.cell, draft.day === day && styles.cellSelected]}
                          >
                            <Text
                              style={[
                                styles.cellLabel,
                                draft.day === day && styles.cellLabelSelected,
                              ]}
                            >
                              {day}
                            </Text>
                          </PressableScale>
                        ),
                      )}
                    </View>
                  ))}
                </View>

                <Text style={styles.label}>시각</Text>
                <View style={styles.wrap}>
                  {SETTLEMENT_TIME_PRESETS.map((preset) => (
                    <Chip
                      key={preset.hour}
                      label={formatPreset(preset)}
                      selected={draft.hour === preset.hour && draft.minute === 0}
                      onPress={() => onChange({ hour: preset.hour, minute: 0 })}
                    />
                  ))}
                </View>
                {/* 넷에 없는 시각은 30분씩 옮겨서 닿는다. 가운데 글자가 지금 고른 값이다 */}
                <View style={styles.stepper}>
                  <PressableScale
                    small
                    accessibilityRole="button"
                    accessibilityLabel="30분 앞당기기"
                    onPress={() => onChange(stepTime(draft.hour, draft.minute, -1))}
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepGlyph}>−</Text>
                  </PressableScale>
                  <Text style={styles.stepValue}>{formatTime(draft.hour, draft.minute)}</Text>
                  <PressableScale
                    small
                    accessibilityRole="button"
                    accessibilityLabel="30분 늦추기"
                    onPress={() => onChange(stepTime(draft.hour, draft.minute, 1))}
                    style={styles.stepButton}
                  >
                    <Text style={styles.stepGlyph}>+</Text>
                  </PressableScale>
                </View>

                {error ? <ErrorText>{error}</ErrorText> : null}
                <Button label="저장" loading={saving} onPress={onSave} />
              </ScrollView>
            ) : null}
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  gestureRoot: { flex: 1 },
  backdropWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
  },
  /** 알약과 제목을 함께 담는 **잡는 영역**. 이 띠 전체가 손잡이다 */
  header: { paddingTop: t.space.sm, paddingBottom: t.space.md, gap: t.space.lg },
  content: { paddingHorizontal: t.space.lg, gap: t.space.md },
  grabber: {
    alignSelf: 'center',
    width: t.size.grabberWidth,
    height: t.size.grabberHeight,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
  },
  /** 시트가 아니라 안쪽이 패딩을 가지므로 스크롤 밖에 있는 제목만 따로 들여쓴다 */
  title: {
    ...t.font.title,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    paddingHorizontal: t.space.lg,
  },
  preview: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.primary },
  label: { ...t.font.sectionTitle, fontWeight: t.weight.bold, color: t.colors.inkSoft },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },

  grid: { gap: t.space.xs },
  gridRow: { flexDirection: 'row', gap: t.space.xs },
  /** 칸 폭은 줄이 나눠 가진다 — 빈 칸도 같은 몫을 가져야 마지막 줄 칸이 안 커진다 */
  cellSlot: { flex: 1 },
  cell: {
    minHeight: t.size.touch,
    borderRadius: t.radius.md,
    borderWidth: t.border.control,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 칩의 선택 모양과 같다 — 같은 시트 안에서 「골랐다」 가 두 모양이면 안 된다
  cellSelected: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
  cellLabel: { ...t.font.body, fontWeight: t.weight.semibold, color: t.colors.inkSoft },
  cellLabelSelected: { color: t.colors.primary, fontWeight: t.weight.bold },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  stepButton: {
    width: t.size.touch,
    height: t.size.touch,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepGlyph: { ...t.font.title, fontWeight: t.weight.bold, color: t.colors.inkSoft },
  stepValue: {
    ...t.font.bodyLg,
    fontWeight: t.weight.bold,
    color: t.colors.ink,
    flex: 1,
    textAlign: 'center',
  },
}));
