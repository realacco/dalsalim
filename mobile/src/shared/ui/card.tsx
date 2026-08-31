import { ReactNode } from 'react';
import { View, ViewStyle } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';
import { PressableScale } from './pressable-scale';

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** 누를 수 있는 카드는 눌림 피드백을 갖는다 */
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();

  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  card: {
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    padding: t.space.lg,
    borderWidth: 1,
    borderColor: t.colors.line,
    ...t.shadow.card,
  },
  cardPressed: { backgroundColor: t.colors.surfacePressed },
}));
