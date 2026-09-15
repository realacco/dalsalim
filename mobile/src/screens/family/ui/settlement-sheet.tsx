import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  SETTLEMENT_DAYS,
  SETTLEMENT_HOURS,
  SETTLEMENT_MINUTES,
  formatHour,
  formatSettlement,
  shortMonthHint,
} from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import type { Settlement } from '@/shared/model/types';
import { Button, Chip, ErrorText, Muted } from '@/shared/ui';

/**
 * 정산일을 고르는 아래 시트. draft 가 없으면 닫혀 있다.
 * 입력창이 없어 키보드도, 끌어내리기도 없다 — 칩만 누른다. (고정비 시트보다 가볍게 둔 이유)
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
    <Modal visible={draft !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdropWrap}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>정산일</Text>
          {/* 칩이 쉰 개 남짓이라 큰 글자 설정에서는 화면을 넘는다 — 뚜껑을 두고 안에서 스크롤 (저장 버튼이 잘리면 기능이 막힌다) */}
          {draft ? (
            /*
              좌우·아래 여백은 시트가 아니라 contentContainerStyle 에 준다. 시트에 패딩을 주면
              ScrollView 가 그만큼 안쪽에 놓여서 스크롤바가 화면 끝이 아니라 칩 위에 그려진다.
              (고정비 시트와 같은 이유 — `fixed-expense-sheet.tsx`)
            */
            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.preview}>{formatSettlement(draft)}</Text>
              {hint ? <Muted>{hint}</Muted> : null}

              <Text style={styles.label}>날짜</Text>
              <View style={styles.wrap}>
                {SETTLEMENT_DAYS.map((day) => (
                  <Chip
                    key={day}
                    label={`${day}`}
                    selected={draft.day === day}
                    onPress={() => onChange({ day })}
                  />
                ))}
              </View>

              <Text style={styles.label}>시각</Text>
              {/* 가로 스크롤이면 골라둔 칩이 화면 밖에 있을 수 있다 — 접어서 전부 보이게 */}
              <View style={styles.wrap}>
                {SETTLEMENT_HOURS.map((hour) => (
                  <Chip
                    key={hour}
                    label={formatHour(hour)}
                    selected={draft.hour === hour}
                    onPress={() => onChange({ hour })}
                  />
                ))}
              </View>
              <View style={styles.row}>
                {SETTLEMENT_MINUTES.map((minute) => (
                  <Chip
                    key={minute}
                    label={`${String(minute).padStart(2, '0')}분`}
                    selected={draft.minute === minute}
                    onPress={() => onChange({ minute })}
                  />
                ))}
              </View>

              {error ? <ErrorText>{error}</ErrorText> : null}
              <Button label="저장" loading={saving} onPress={onSave} />
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdropWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.overlay },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '90%',
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    paddingTop: t.space.sm,
    gap: t.space.md,
  },
  content: { paddingHorizontal: t.space.lg, gap: t.space.md },
  grabber: {
    alignSelf: 'center',
    width: t.size.grabberWidth,
    height: t.size.grabberHeight,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
    marginBottom: t.space.xs,
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
  row: { flexDirection: 'row', gap: t.space.sm },
}));
