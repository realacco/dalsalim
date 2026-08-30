import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/shared/config/theme';

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const ratio = total > 0 ? Math.min(step / total, 1) : 0;

  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
});
