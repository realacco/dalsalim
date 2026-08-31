import { ReactNode } from 'react';
import { ScrollView, ViewStyle } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';

export function ScreenScroll({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
}) {
  const styles = useStyles();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  scroll: { flex: 1, backgroundColor: t.colors.bg },
  content: { padding: t.space.screen, paddingBottom: t.space.xxl * 2 },
}));
