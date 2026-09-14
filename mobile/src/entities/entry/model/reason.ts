import type { LineKind } from '@/shared/model/types';

/** 사유 판정에 필요한 최소한의 모양. 줄 종류가 판정에 들어가므로 금액 둘만으로는 부족하다 */
export type ReasonableLine = {
  kind: LineKind;
  plannedAmount: number | null;
  actualAmount: number | null;
};

/**
 * 사유가 필요한가? — server/src/lib/shared.ts 의 needsReason() 을 그대로 옮긴 것이다.
 *
 * 최종 판정은 서버가 한다. 여기 있는 것은 위저드가 [다음] 버튼을 잠글지 정하려는
 * UX 용 사본이지 방어선이 아니다. 서버 규칙이 바뀌면 이 함수도 같이 바꾼다.
 *
 * 결산 줄(SETTLEMENT)은 금액이 달라도 묻지 않는다 — 옮겨둔 돈을 얼마나 썼는지는 정정이지 변화가 아니다 (F-ENT-11).
 */
export function needsReason(line: ReasonableLine): boolean {
  if (line.kind === 'SETTLEMENT') return false;
  if (line.plannedAmount === null || line.actualAmount === null) return false;
  return line.plannedAmount !== line.actualAmount;
}
