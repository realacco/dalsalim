import { useEffect, useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { digitsOnly, formatAmount } from '@/shared/lib/format';
import { PressableScale } from './pressable-scale';

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
  allowSum = false,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  /**
   * 여러 건을 더해서 한 줄로 적을 수 있게 한다.
   *
   * 실제 흐름이 "카드 앱을 보면서 하나씩 골라 더한 총액을 적는 것"이라,
   * 아픈 건 옮겨 적는 일이 아니라 더하는 일이다. (기획서 7.7)
   */
  allowSum?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  /**
   * 담아둔 금액들. 총액(value)은 바깥이 갖고 있고 여기서는 "무엇을 더해 그 총액이 됐는지"만 기억한다.
   * 그래서 입력칸에 보일 값은 빼서 구한다 — 상태를 두 벌 두면 서로 어긋난다.
   */
  const [parts, setParts] = useState<number[]>([]);
  const banked = parts.reduce((sum, part) => sum + part, 0);
  const current = value === null ? null : value - banked;

  // 안드로이드는 뒤로가기로 키보드를 내려도 포커스가 풀리지 않아 onBlur 가 오지 않는다.
  // 그대로 두면 다 적고 키보드만 내렸을 때 콤마 없는 숫자가 계속 보인다.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => setEditing(false));
    return () => subscription.remove();
  }, []);

  // 바깥에서 값을 비우면(다른 줄로 넘어갔다는 뜻) 담아둔 것도 같이 버린다
  useEffect(() => {
    if (value === null) setParts([]);
  }, [value]);

  const text = editing ? draft : current === null || current === 0 ? '' : formatAmount(current);
  const canBank = allowSum && current !== null && current > 0;

  /** 지금 칸에 있는 금액을 담고 칸을 비운다. 총액은 그대로다. */
  function bank() {
    if (current === null || current <= 0) return;
    setParts([...parts, current]);
    setDraft('');
  }

  /** 마지막으로 담은 것을 뺀다. 총액에서도 같이 빠진다. */
  function undo() {
    const last = parts.at(-1);
    if (last === undefined) return;
    setParts(parts.slice(0, -1));
    onChange((value ?? 0) - last);
  }

  return (
    <View style={{ gap: 0 }}>
      <View style={styles.row}>
        <TextInput
          value={text}
          onFocus={() => {
            setDraft(current === null || current === 0 ? '' : String(current));
            setEditing(true);
          }}
          onBlur={() => setEditing(false)}
          onChangeText={(next) => {
            // 자릿수를 먼저 자른다. 상한을 넘겨 잘린 값이 화면에 남으면
            // 사용자가 친 것과 보이는 게 어긋난다.
            const digits = digitsOnly(next).replace(/^0+(?=\d)/, '').slice(0, 10);
            const typed = digits === '' ? null : Math.min(Number(digits), MAX_AMOUNT);

            setDraft(typed === null ? '' : String(typed));

            // 담아둔 게 있으면 칸을 비워도 총액은 남아 있어야 한다
            if (typed === null) onChange(banked === 0 ? null : banked);
            else onChange(banked + typed);
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

        {allowSum ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="지금 금액을 담고 다음 금액 입력하기"
            accessibilityState={{ disabled: !canBank }}
            onPress={bank}
            disabled={!canBank}
            small
            containerStyle={styles.plusSlot}
            style={[styles.plus, !canBank && styles.plusOff]}
          >
            <Text style={styles.plusLabel}>+</Text>
          </PressableScale>
        ) : null}
      </View>

      {/*
        합계는 입력칸 "아래"에만 그린다. 칸 안의 글자를 우리가 바꾸면 커서가 밀린다 —
        3자리 콤마로 이미 한 번 데였다. (시행착오 1-1)
      */}
      {parts.length > 0 ? (
        <View style={styles.sumRow}>
          <Text style={styles.sumText} numberOfLines={2}>
            {parts.map(formatAmount).join(' + ')}
            {current !== null && current > 0 ? ` + ${formatAmount(current)}` : ''}
            {' = '}
            <Text style={styles.sumTotal}>{formatAmount(value ?? 0)}원</Text>
          </Text>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="마지막에 담은 금액 빼기"
            onPress={undo}
            small
            containerStyle={styles.undoSlot}
            style={styles.undo}
          >
            <Text style={styles.undoLabel}>되돌리기</Text>
          </PressableScale>
        </View>
      ) : null}
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

  plusSlot: { paddingBottom: t.space.xs },
  plus: {
    width: 44,
    height: 44,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusOff: { opacity: 0.35 },
  plusLabel: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.primary },

  sumRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: t.space.sm,
    marginTop: t.space.sm,
  },
  sumText: { ...t.font.caption, color: t.colors.inkFaint, flex: 1, lineHeight: 18 },
  sumTotal: { fontWeight: t.weight.bold, color: t.colors.inkSoft },
  undoSlot: {},
  undo: { paddingHorizontal: t.space.sm, paddingVertical: t.space.xs },
  undoLabel: { ...t.font.caption, fontWeight: t.weight.semibold, color: t.colors.primary },
}));
