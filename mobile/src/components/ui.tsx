import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { colors, font, radius, shadow, space } from '../theme';
import { digitsOnly, formatAmount } from '../lib/format';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'kakao' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'kakao' && styles.buttonKakao,
        variant === 'danger' && styles.buttonDanger,
        inactive && styles.buttonDisabled,
        pressed && !inactive && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.ink : colors.surface} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'ghost' && { color: colors.inkSoft },
            variant === 'kakao' && { color: colors.kakaoInk },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      {...props}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  );
}

/** 큰 금액 입력. 타이핑하는 동안 3자리 콤마를 유지한다. */
export function AmountInput({
  value,
  onChange,
  autoFocus,
  size = 'lg',
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
}) {
  const text = value === null ? '' : formatAmount(value);

  return (
    <View style={styles.amountRow}>
      <TextInput
        value={text}
        onChangeText={(next) => {
          const digits = digitsOnly(next);
          onChange(digits === '' ? null : Math.min(Number(digits), 1_000_000_000));
        }}
        keyboardType="number-pad"
        inputMode="numeric"
        placeholder="0"
        placeholderTextColor={colors.inkFaint}
        autoFocus={autoFocus}
        selectTextOnFocus
        style={[styles.amountInput, size === 'md' && styles.amountInputMd]}
      />
      <Text style={[styles.amountUnit, size === 'md' && { ...font.bodyLg }]}>원</Text>
    </View>
  );
}

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const ratio = total > 0 ? Math.min(step / total, 1) : 0;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Muted style={{ marginTop: space.md }}>{label}</Muted> : null}
    </View>
  );
}

export function ScreenScroll({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: space.xxl * 2 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** 좌우로 벌린 한 줄. 요약·합계에 계속 쓰인다. */
export function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'up' | 'down' | 'default';
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, strong && { color: colors.ink, fontWeight: '600' }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.rowValue,
          strong && { ...font.bodyLg, fontWeight: '700' },
          tone === 'up' && { color: colors.up },
          tone === 'down' && { color: colors.down },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadow.card,
  },
  sectionTitle: {
    ...font.small,
    color: colors.inkFaint,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: space.sm,
  },
  muted: { ...font.small, color: colors.inkFaint },

  button: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.lineStrong },
  buttonKakao: { backgroundColor: colors.kakao },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  buttonLabel: { ...font.bodyLg, color: colors.surface, fontWeight: '700' },

  fieldLabel: { ...font.small, color: colors.inkSoft, fontWeight: '700' },
  fieldHint: { ...font.caption, color: colors.inkFaint },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...font.bodyLg,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 120, textAlignVertical: 'top', paddingTop: space.md },

  amountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  amountInput: {
    flex: 1,
    ...font.amount,
    fontWeight: '700',
    color: colors.ink,
    paddingVertical: space.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.lineStrong,
    textAlign: 'right',
  },
  amountInputMd: { ...font.title, fontWeight: '700' },
  amountUnit: { ...font.title, color: colors.inkSoft, paddingBottom: space.md },

  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.primary },

  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipLabel: { ...font.small, color: colors.inkSoft },
  chipLabelSelected: { color: colors.primary, fontWeight: '700' },

  error: { ...font.small, color: colors.danger },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  rowLabel: { ...font.body, color: colors.inkSoft, flexShrink: 1 },
  rowValue: { ...font.body, color: colors.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },

  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.md },
});
