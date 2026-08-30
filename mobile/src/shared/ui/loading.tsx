import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, space } from '@/shared/config/theme';
import { Muted } from './text';

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Muted style={{ marginTop: space.md }}>{label}</Muted> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
