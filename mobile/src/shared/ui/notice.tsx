import { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';

/**
 * 사실을 알려주는 띠. 경고가 아니다 — 강한 색을 쓰지 않는다.
 * "엄마가 아직 안 적었어요" 처럼 화면의 숫자가 무엇을 기준으로 하는지 밝힐 때 쓴다.
 */
export function Notice({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.notice}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  notice: {
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.lg,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
  },
  text: { ...t.font.small, color: t.colors.inkSoft, lineHeight: 20 },
}));
