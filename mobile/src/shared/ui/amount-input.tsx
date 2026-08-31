import { useEffect, useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
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
  const styles = useStyles();
  const { colors } = useTheme();
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
    <View style={styles.row}>
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
        style={[styles.input, size === 'md' && styles.inputMd, editing && styles.inputEditing]}
      />
      <Text style={[styles.unit, size === 'md' && styles.unitMd]}>원</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: t.space.sm },
  input: {
    flex: 1,
    ...t.font.amountLg,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    paddingVertical: t.space.sm,
    borderBottomWidth: 2,
    borderBottomColor: t.colors.lineStrong,
    textAlign: 'right',
  },
  inputEditing: { borderBottomColor: t.colors.primary },
  inputMd: { ...t.font.title, fontWeight: t.weight.heavy },
  unit: { ...t.font.title, color: t.colors.inkSoft, paddingBottom: t.space.md },
  unitMd: { ...t.font.bodyLg, color: t.colors.inkSoft, paddingBottom: t.space.md },
}));
