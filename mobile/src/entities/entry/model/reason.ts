/**
 * 사유가 필요한가? — server/src/lib/shared.ts 의 needsReason() 을 그대로 옮긴 것이다.
 *
 * 최종 판정은 서버가 한다. 여기 있는 것은 위저드가 [다음] 버튼을 잠글지 정하려는
 * UX 용 사본이지 방어선이 아니다. 서버 규칙이 바뀌면 이 함수도 같이 바꾼다.
 */
export function needsReason(plannedAmount: number | null, actualAmount: number | null): boolean {
  if (plannedAmount === null || actualAmount === null) return false;
  return plannedAmount !== actualAmount;
}
