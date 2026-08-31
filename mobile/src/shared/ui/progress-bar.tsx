import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';

/** 스텝이 넘어갈 때 진행 바가 뚝 끊기지 않고 흘러가게 한다. */
export function ProgressBar({ step, total }: { step: number; total: number }) {
  const styles = useStyles();
  const { motion } = useTheme();
  const ratio = total > 0 ? Math.min(step / total, 1) : 0;
  const width = useRef(new Animated.Value(ratio)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: ratio,
      duration: motion.base,
      // width 는 레이아웃 속성이라 네이티브 드라이버를 못 쓴다
      useNativeDriver: false,
    }).start();
  }, [ratio, width, motion.base]);

  const percent = width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: percent }]} />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  track: {
    height: 5,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: 5, borderRadius: t.radius.pill, backgroundColor: t.colors.primary },
}));
