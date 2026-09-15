// 기능: F-FAM-11
import type { FamilyContents } from './types';

/**
 * "기록한 달 7개월 · 고정비 9개도 함께 지워져요." — 없애면 사라지는 것을 세어 문장으로 (F-FAM-11).
 * 하나도 없으면 빈 문자열이다. "0개가 사라져요" 는 겁만 주고 정보가 없다.
 *
 * 화면이 아니라 여기 있는 이유: 확인 문구는 개수 조합마다 갈라지는데,
 * 컴포넌트 안에 있으면 1층에서 못 본다. 실제로 조사 실수가 여기서 났다.
 *
 * 항목 뒤에는 받침에 따라 변하는 조사(이/가 · 을/를)를 붙이지 않는다 —
 * "…개월이" 와 "…개가" 가 갈리므로 `도` 처럼 안 변하는 조사만 쓴다.
 */
export function contentsLine(contents: FamilyContents | null): string {
  if (!contents) return '';

  const parts: string[] = [];
  if (contents.months > 0) parts.push(`기록한 달 ${contents.months}개월`);
  if (contents.fixedExpenses > 0) parts.push(`고정비 ${contents.fixedExpenses}개`);

  return parts.length > 0 ? `\n${parts.join(' · ')}도 함께 지워져요.` : '';
}
