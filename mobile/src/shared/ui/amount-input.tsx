import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, space } from '@/shared/config/theme';
import { digitsOnly, formatAmount } from '@/shared/lib/format';

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

const styles = StyleSheet.create({
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
});
