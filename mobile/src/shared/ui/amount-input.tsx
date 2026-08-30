import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, space } from '@/shared/config/theme';
import { digitsOnly, formatAmount } from '@/shared/lib/format';

const MAX_AMOUNT = 1_000_000_000;

/**
 * 큰 금액 입력.
 *
 * ★ 타이핑하는 동안에는 콤마를 넣지 않는다.
 *
 * 예전에는 매 글자마다 3자리 콤마를 다시 붙였는데, 그러면 우리가 넣은 콤마 때문에
 * 문자열 길이가 사용자가 친 것보다 길어지고 커서가 그만큼 뒤로 밀린다.
 * 다음 숫자가 엉뚱한 자리에 끼어들어 800000 을 치면 8,000,000 이 됐다.
 * (에뮬레이터에서 한 글자씩 천천히 쳐도 그대로 재현됐다)
 *
 * 그래서 포커스 중에는 사용자가 친 숫자를 그대로 두고, 포커스가 빠질 때만 콤마를 붙인다.
 * 입력 중 문자열 길이가 절대 바뀌지 않으므로 커서가 밀릴 일이 없다.
 */
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  // 안드로이드는 뒤로가기로 키보드를 내려도 포커스가 풀리지 않아 onBlur 가 오지 않는다.
  // 그대로 두면 다 적고 키보드만 내렸을 때 콤마 없는 숫자가 계속 보인다.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => setEditing(false));
    return () => subscription.remove();
  }, []);

  const text = editing ? draft : value === null ? '' : formatAmount(value);

  return (
    <View style={styles.amountRow}>
      <TextInput
        value={text}
        onFocus={() => {
          setDraft(value === null ? '' : String(value));
          setEditing(true);
        }}
        onBlur={() => setEditing(false)}
        onChangeText={(next) => {
          // 자릿수를 먼저 자른다. 상한을 넘겨 잘린 값이 화면에 남으면
          // 사용자가 친 것과 보이는 게 어긋난다.
          const digits = digitsOnly(next).replace(/^0+(?=\d)/, '').slice(0, 10);
          const amount = digits === '' ? null : Math.min(Number(digits), MAX_AMOUNT);

          setDraft(amount === null ? '' : String(amount));
          onChange(amount);
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
