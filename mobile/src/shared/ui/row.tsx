import { StyleSheet, Text, View } from 'react-native';

import { colors, font, space } from '@/shared/config/theme';

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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  rowLabel: { ...font.body, color: colors.inkSoft, flexShrink: 1 },
  rowValue: { ...font.body, color: colors.ink, fontWeight: '600', fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: space.md },
});
