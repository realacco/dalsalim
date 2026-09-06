import { ApiError } from '@/shared/api/client';

/**
 * 잡은 오류에서 사람에게 보여줄 문장을 꺼낸다.
 *
 * 서버가 준 message 는 그대로 화면에 뜨는 한국어다 (CLAUDE.md 코드 규칙).
 * 그 밖의 오류(코드 버그, 예상 못 한 예외)는 사용자에게 내용을 보여줄 이유가 없으므로
 * 상황에 맞는 폴백 문장으로 바꾼다. 폴백은 shared/config/messages 에서 고른다.
 */
export function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}
