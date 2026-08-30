import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, space } from '@/shared/config/theme';

/**
 * 사실을 알려주는 띠. 경고가 아니다 — 색을 쓰지 않는다.
 * "엄마가 아직 안 적었어요" 처럼 화면의 숫자가 무엇을 기준으로 하는지 밝힐 때 쓴다.
 */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  text: { ...font.small, color: colors.inkSoft, lineHeight: 20 },
});
