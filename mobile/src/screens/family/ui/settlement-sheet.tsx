import { ScrollView, Text, View } from 'react-native';
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
import { Button, Chip, ErrorText, Muted, PressableScale, Sheet } from '@/shared/ui';

/**
 * 정산일을 고르는 아래 시트. draft 가 없으면 닫혀 있다.
 * 격자 칸 · 칩 · −/+ 만 누르고 적는 칸이 없어서 배경을 눌러 닫아도 잃을 것이 없다 (`dismissOnBackdrop`).
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
    <Sheet visible={draft !== null} onClose={onClose} title="정산일" dismissOnBackdrop capHeight>
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
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]}
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
                        style={[styles.cellLabel, draft.day === day && styles.cellLabelSelected]}
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
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: t.space.xl, gap: t.space.md },
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
  // 크기를 못 박지 않는다 — 큰 글자 설정에서 글리프가 세로로 잘린다. 날짜 칸과 같은 규칙
  stepButton: {
    minWidth: t.size.touch,
    minHeight: t.size.touch,
    paddingHorizontal: t.space.sm,
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
