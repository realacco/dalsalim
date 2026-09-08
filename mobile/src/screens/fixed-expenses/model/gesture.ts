/**
 * 아래 시트를 손가락으로 다루는 판정 둘.
 *
 * 화면 조각에서 떼어낸 이유: **여기가 1층에서 잡히는 유일한 지점**이다.
 * 스프링이 부드러운지, 좌표가 손가락을 따라오는지는 사람이 눌러봐야 알지만
 * "언제 잡고 언제 닫는가"는 순수 함수라 테스트가 지킬 수 있다.
 * 실제로 속도 판정의 방향 버그가 코드 리뷰에서야 잡혔다 — 그 자리를 여기로 내린다.
 */

/** 이만큼 내려가야 "끌기"로 친다. 손가락은 가만히 있어도 몇 dp 씩 떨린다 */
export const DRAG_START_SLOP = 4;

/** 이만큼 끌어내리면 닫는다 */
export const DISMISS_DISTANCE = 96;

/** 이보다 빠르게 아래로 튕기면 닫는다 */
export const DISMISS_VELOCITY = 0.7;

/**
 * 시트가 이 제스처를 가져올까.
 *
 * 세로로 **확실히** 움직일 때만 가져온다 — 그래야 분류 칩을 가로로 훑는 손짓을 안 뺏는다.
 */
export function shouldStartDrag(dy: number, dx: number): boolean {
  return dy > DRAG_START_SLOP && Math.abs(dy) > Math.abs(dx);
}

/**
 * 손을 뗐을 때 닫을까.
 *
 * 거리 **또는** 속도, 둘 중 하나만 넘으면 된다 — 거리로만 재면 짧고 빠르게 튕기는 손짓이
 * 안 먹고, 속도로만 재면 천천히 끝까지 끌어내려도 안 닫힌다.
 *
 * ⚠️ **속도 쪽에는 방향이 붙어야 한다.** `shouldStartDrag` 는 제스처를 처음 가져올 때만
 * 보므로, 일단 잡고 나면 손가락이 시작점 위로 갈 수 있다. 아래로 살짝 눌러 잡고(dy=5)
 * 위로 올렸다가(dy=-50) 아래로 튕기며 떼면 dy 는 음수인데 vy 만 크다 —
 * 방향을 안 보면 **화면에서 움직이지도 않은 시트가 사라진다.**
 */
export function shouldDismiss(dy: number, vy: number): boolean {
  return dy > DISMISS_DISTANCE || (dy > 0 && vy > DISMISS_VELOCITY);
}
