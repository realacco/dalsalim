// 기능: F-ENT-09
import { useEffect, useState } from 'react';
import { Keyboard, Text, TextInput, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { MAX_AMOUNT } from '@/shared/lib/calc';
import { digitsOnly, formatAmount } from '@/shared/lib/format';
import { CalculatorSheet } from './calculator-sheet';
import { PressableScale } from './pressable-scale';

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
  calculator = false,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  /**
   * 옵션이다 — 켜면 칸 오른쪽에 [계산기] 가 붙고, 누르면 자판까지 있는 아래 시트가 올라온다.
   *
   * 기본은 꺼짐이다. 이 컴포넌트는 **금액 하나를 받는 일**만 알면 되고,
   * 계산기가 필요한지는 부르는 화면이 안다. (기능 정의서 F-ENT-09 의 표가 어디에 켜져 있는지를 말한다)
   */
  calculator?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  /**
   * 포커스한 순간 **한 번만** 전체 선택하기 위한 값. 첫 타이핑에 곧바로 놓아준다.
   *
   * ★ `selectTextOnFocus` 를 쓰면 안 된다. 안드로이드에서는 그 값이 켜져 있으면
   * **포커스를 잡은 뒤 글자가 프로그램으로 세팅될 때마다 전체 선택이 다시 걸린다.**
   * 이 칸은 한 글자마다 `draft` 를 세팅하는 컨트롤드 입력이라 매 글자가 그 조건에 걸려서,
   * 첫 숫자에 블록이 씌워지고 다음 숫자가 그걸 덮어썼다 — 두 번째 입력이 첫 글자가 됐다.
   *
   * 그래도 전체 선택 자체는 지켜야 한다. 위저드는 **지난달 금액이 채워진 채 자동 포커스**되는
   * 화면이라, 다른 금액을 적으려면 먼저 지워야 하는 칸이 되면 매달 성가시다.
   */
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>(undefined);

  const [calcOpen, setCalcOpen] = useState(false);

  /** 계산기로 만든 금액이면 무엇을 해서 그렇게 됐는지 한 줄 남긴다. 손으로 고치면 지운다 */
  const [expression, setExpression] = useState('');

  // 안드로이드는 뒤로가기로 키보드를 내려도 포커스가 풀리지 않아 onBlur 가 오지 않는다.
  // 그대로 두면 다 적고 키보드만 내렸을 때 콤마 없는 숫자가 계속 보인다.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => setEditing(false));
    return () => subscription.remove();
  }, []);

  // 바깥에서 값을 비우면(다른 줄로 넘어갔다는 뜻) 수식도 같이 버린다
  useEffect(() => {
    if (value === null) setExpression('');
  }, [value]);

  const text = editing ? draft : value === null || value === 0 ? '' : formatAmount(value);

  return (
    <View>
      <View style={styles.row}>
        <TextInput
          value={text}
          onFocus={() => {
            const raw = value === null || value === 0 ? '' : String(value);
            setDraft(raw);
            setEditing(true);
            // 채워져 있던 금액은 통째로 선택해 둔다. 바로 새 금액을 칠 수 있게
            setSelection(raw === '' ? undefined : { start: 0, end: raw.length });
          }}
          onBlur={() => setEditing(false)}
          onChangeText={(next) => {
            // 첫 글자를 치는 순간 커서를 놓아준다. 계속 쥐고 있으면 매 글자가 선택된다
            setSelection(undefined);
            // 손으로 고치면 아까 수식은 더 이상 이 금액의 근거가 아니다
            setExpression('');

            // 자릿수를 먼저 자른다. 상한을 넘겨 잘린 값이 화면에 남으면
            // 사용자가 친 것과 보이는 게 어긋난다.
            const digits = digitsOnly(next)
              .replace(/^0+(?=\d)/, '')
              .slice(0, 10);
            const typed = digits === '' ? null : Math.min(Number(digits), MAX_AMOUNT);

            setDraft(typed === null ? '' : String(typed));

            onChange(typed);
          }}
          keyboardType="number-pad"
          inputMode="numeric"
          placeholder="0"
          placeholderTextColor={colors.inkFaint}
          autoFocus={autoFocus}
          selection={selection}
          style={[styles.input, size === 'md' && styles.inputMd, editing && styles.inputEditing]}
        />
        <Text style={[styles.unit, size === 'md' && styles.unitMd]}>원</Text>

        {calculator ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="계산기 열기"
            onPress={() => setCalcOpen(true)}
            small
            containerStyle={styles.calcSlot}
            style={styles.calc}
          >
            <Text style={styles.calcLabel}>계산기</Text>
          </PressableScale>
        ) : null}
      </View>

      {/*
        어떻게 이 금액이 됐는지 한 줄. 칸 안에 안 쓰고 밖에 그린다 —
        칸 속 글자를 우리가 바꾸면 커서가 밀린다 (시행착오 1-1).
      */}
      {expression ? <Text style={styles.expression}>{expression}</Text> : null}

      {calculator ? (
        <CalculatorSheet
          visible={calcOpen}
          initial={value}
          onCancel={() => setCalcOpen(false)}
          onConfirm={(next, expr) => {
            setCalcOpen(false);
            // 포스스가 남은 채 열었다면 editing 이 true 라 칸에 역 드래프트가 그대로 보인다.
            // keyboardDidHide 가 오면 풀리긴 하지만, Modal 은 별도의 네이티브 창이라 그 이벤트를
            // 믿지 않는다 — 확정한 금액이 칸에 안 보이는 건 그 자체로 고장이다
            setEditing(false);
            setExpression(expr);
            onChange(next);
          }}
        />
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

  calcSlot: { paddingBottom: t.space.xs },
  calc: {
    height: 44,
    paddingHorizontal: t.space.md,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calcLabel: { ...t.font.small, fontWeight: t.weight.bold, color: t.colors.primary },
  expression: {
    ...t.font.hint,
    color: t.colors.inkFaint,
    textAlign: 'right',
    marginTop: t.space.xs,
  },
}));
