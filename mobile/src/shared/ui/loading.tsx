import { ActivityIndicator, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Muted } from './text';

export function Loading({ label }: { label?: string }) {
  const styles = useStyles();
  const { colors, space } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Muted style={{ marginTop: space.md }}>{label}</Muted> : null}
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: t.space.xxl,
    backgroundColor: 'transparent',
  },
}));
