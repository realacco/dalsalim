import { ApiError } from '@/shared/api/client';

/**
 * 잡은 오류에서 사람에게 보여줄 문장을 꺼낸다.
 *
 * 서버가 준 message 는 그대로 화면에 뜨는 한국어다 (CLAUDE.md 코드 규칙).
 * 그 밖의 오류(코드 버그, 예상 못 한 예외)는 사용자에게 내용을 보여줄 이유가 없으므로
 * 상황에 맞는 폴백 문장으로 바꾼다. 폴백은 shared/config/messages 에서 고른다.
 *
 * 빈 문장도 폴백으로 넘긴다 — 그대로 보여주면 화면에 아무것도 안 뜨고,
 * 그건 이 앱이 M-5 에서 없앤 "빈 화면"과 같은 실수다.
 */
export function errorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && caught.message.trim()) return caught.message;
  return fallback;
}
