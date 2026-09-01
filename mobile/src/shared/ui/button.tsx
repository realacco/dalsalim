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
      /*
        레이아웃(flex 등)은 바깥 컨테이너로 보낸다. 안쪽 Pressable 에 flex 를 주면
        컨테이너가 폭을 안 가져가서 버튼이 글자 너비로 쪼그라든다.
        나란히 놓인 [승인][거절] 이 좁게 붙어 나오던 게 이 문제였다.
      */
      containerStyle={style}
      style={[styles.button, face, inactive && styles.disabled] as ViewStyle[]}
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
