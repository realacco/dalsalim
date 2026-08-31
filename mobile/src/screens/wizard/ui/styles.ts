import { makeStyles } from '@/shared/config/theme-provider';

/** 모든 스텝이 같은 여백과 같은 질문 타이포를 쓴다 — 한 화면에 질문 하나라는 규칙의 시각적 표현이다. */
export const useStepStyles = makeStyles((t) => ({
  body: { padding: t.space.screen, paddingBottom: t.space.xxl * 2 },
  question: { ...t.font.question, fontWeight: t.weight.heavy, color: t.colors.ink },
  cardTitle: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
}));
