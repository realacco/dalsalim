import { ReactNode } from 'react';
import { ScrollView, ViewStyle } from 'react-native';

import { colors, space } from '@/shared/config/theme';

export function ScreenScroll({
  children,
  contentStyle,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
}) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: space.xxl * 2 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
