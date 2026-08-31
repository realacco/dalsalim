import { ReactNode, useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle } from 'react-native';

import { useTheme } from '@/shared/config/theme-provider';

/**
 * 누르면 살짝 들어가는 터치 영역.
 *
 * 눌림 피드백이 없으면 "눌렀나?" 싶어 한 번 더 누르게 된다. opacity 만 바꾸는 것보다
 * 아주 조금 줄어드는 쪽이 손끝의 감각과 맞는다. scale/opacity 는 네이티브 드라이버로
 * 돌아가므로 JS 가 바빠도 끊기지 않는다.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  small,
  disabled,
  ...rest
}: PressableProps & {
  children: ReactNode;
  /** Pressable 과 같은 형태를 받는다 — 배열도, pressed 를 받는 함수도 */
  style?: PressableProps['style'];
  /**
   * 바깥 Animated.View 에 걸린다.
   * flex 같은 레이아웃은 여기로 줘야 한다 — style 은 안쪽 Pressable 에만 걸려서
   * 바깥 컨테이너가 폭을 못 가진다. (탭 바가 무너져서 알았다)
   */
  containerStyle?: ViewStyle;
  /** 아이콘처럼 작은 것은 더 많이 줄어야 눌린 게 보인다 */
  small?: boolean;
}) {
  const { motion } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number, duration: number) =>
    Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(event) => {
          if (!disabled) animate(small ? motion.pressScaleSmall : motion.pressScale, motion.fast);
          rest.onPressIn?.(event);
        }}
        onPressOut={(event) => {
          animate(1, motion.base);
          rest.onPressOut?.(event);
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
