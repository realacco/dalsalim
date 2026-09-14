// 기능: F-FIX-07
import { Switch, Text, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';

/**
 * 라벨 + 설명 + 스위치 한 줄.
 *
 * 설명이 두 줄인 이유: 스위치는 "무엇을 물을지"를 정하는 것이지 "얼마를 써야 하는지"를 정하는 게
 * 아니라서(하드룰 9), 켜야 할 때와 꺼도 될 때를 문장으로 같이 준다. 라벨만 있으면 사람은 "목표" 로 읽는다.
 * 줄 전체가 아니라 스위치만 누르게 둔다 — 문장을 읽으려다 값이 바뀌면 안 된다.
 */
export function Toggle({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: colors.lineStrong, true: colors.primary }}
        thumbColor={colors.surface}
        ios_backgroundColor={colors.lineStrong}
      />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space.md },
  text: { flex: 1, gap: t.space.xxs },
  label: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  hint: { ...t.font.hint, color: t.colors.inkSoft },
}));
