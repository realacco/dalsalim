import { StyleSheet } from 'react-native';

import { colors, font, space } from '@/shared/config/theme';

/** 모든 스텝이 같은 여백과 같은 질문 타이포를 쓴다 — 한 화면에 질문 하나라는 규칙의 시각적 표현이다. */
export const stepStyles = StyleSheet.create({
  body: { padding: space.xl, paddingBottom: space.xxl * 2 },
  question: { ...font.question, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  cardTitle: { ...font.body, fontWeight: '700', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
