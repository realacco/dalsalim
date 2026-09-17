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

/**
 * 세션이 끊겨서 실패한 것인가.
 *
 * 401 은 화면이 처리하지 않는다 (CLAUDE.md 실패 표현 표) — api() 가 세션을 비우고
 * 앱 셸이 로그인으로 보낸다. 그런데 던지기는 그대로 던지므로, 동작 실패를 Alert 으로
 * 받는 자리는 로그인 화면 위에 "안 됐어요" 를 한 번 더 띄우게 된다.
 * 그 자리에서 이걸로 걸러 조용히 넘긴다.
 *
 * ⚠️ 앱을 켤 때 저장된 토큰을 지울지도 이것이 가른다 (entities/session 의 hydrate, #67).
 * 여기를 넓히면 서버에 못 닿았을 뿐인데 로그인이 풀리는 경우도 같이 넓어진다.
 */
export function isSessionExpired(caught: unknown): boolean {
  return caught instanceof ApiError && caught.status === 401;
}
