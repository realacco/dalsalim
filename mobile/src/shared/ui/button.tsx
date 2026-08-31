import { ActivityIndicator, Text, ViewStyle } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { PressableScale } from './pressable-scale';

type Variant = 'primary' | 'ghost' | 'kakao' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const face = {
    primary: styles.primary,
    ghost: styles.ghost,
    kakao: styles.kakao,
    danger: styles.danger,
  }[variant];

  const labelTone = {
    primary: styles.labelOnPrimary,
    ghost: styles.labelOnGhost,
    kakao: styles.labelOnKakao,
    danger: styles.labelOnPrimary,
  }[variant];

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={inactive}
      style={[styles.button, face, inactive && styles.disabled, style] as ViewStyle[]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.inkSoft : colors.primaryInk} />
      ) : (
        <Text style={[styles.label, labelTone]}>{label}</Text>
      )}
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  button: {
    height: 54,
    borderRadius: t.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: t.space.lg,
  },
  primary: { backgroundColor: t.colors.primary },
  ghost: { backgroundColor: t.colors.surfaceMuted },
  kakao: { backgroundColor: t.colors.kakao },
  danger: { backgroundColor: t.colors.danger },
  disabled: { opacity: 0.4 },

  label: { ...t.font.bodyLg, fontWeight: t.weight.bold },
  labelOnPrimary: { color: t.colors.primaryInk },
  labelOnGhost: { color: t.colors.inkSoft },
  labelOnKakao: { color: t.colors.kakaoInk },
}));
