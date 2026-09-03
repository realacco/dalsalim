import { Text, View } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';

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
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.labelStrong]}>{label}</Text>
      <Text
        style={[
          styles.value,
          strong && styles.valueStrong,
          tone === 'up' && styles.up,
          tone === 'down' && styles.down,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function Divider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

const useStyles = makeStyles((t) => ({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: t.space.md,
  },
  label: { ...t.font.body, color: t.colors.inkSoft, flexShrink: 1 },
  labelStrong: { color: t.colors.ink, fontWeight: t.weight.semibold },
  value: {
    ...t.font.body,
    color: t.colors.ink,
    fontWeight: t.weight.semibold,
    fontVariant: ['tabular-nums' as const],
  },
  valueStrong: {
    ...t.font.bodyLg,
    fontWeight: t.weight.bold,
    fontVariant: ['tabular-nums' as const],
  },
  up: { color: t.colors.up },
  down: { color: t.colors.down },
  divider: { height: 1, backgroundColor: t.colors.line, marginVertical: t.space.md },
}));
