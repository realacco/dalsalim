/**
 * 아래 시트를 손가락으로 다루는 규칙.
 *
 * 화면 조각에서 떼어낸 이유: **여기가 1층에서 잡히는 유일한 지점**이다.
 * 스프링이 부드러운지, 좌표가 손가락을 따라오는지는 사람이 눌러봐야 알지만
 * "얼마나 내리고 언제 닫는가"는 순수 함수라 테스트가 지킬 수 있다.
 *
 * ⚠️ **여기 오는 값은 `react-native-gesture-handler` 의 것이다.**
 * `translationY` 는 손가락이 **처음 닿은 곳부터**의 거리이고, 제스처가 잡히는 순간에도
 * 0 으로 안 돌아간다 — 그래서 그대로 쓰면 시트가 손가락과 정확히 같이 움직인다.
 *
 * (RN 의 `PanResponder` 는 반대로 잡는 순간 `dy` 를 0 으로 되돌렸다. 그 차이를 모르고
 * 슬롭을 빼뒀다가 시트가 손가락보다 4dp 위에서 따라온 적이 있다 — #18 의 5차 리뷰.
 * 라이브러리를 갈아탈 때 **먼저 확인해야 하는 것이 이 기준점**이다)
 */

/** 세로로 이만큼 움직여야 시트를 잡는다. 손가락은 가만히 있어도 몇 dp 씩 떨린다 */
export const DRAG_START_SLOP = 4;

/** 가로로 이만큼 벗어나면 잡기를 포기한다 — 분류 칩을 훑는 손짓을 안 뺏는다 */
export const DRAG_CANCEL_X = 12;

/** 이만큼 끌어내리면 닫는다 (dp) */
export const DISMISS_DISTANCE = 96;

/**
 * 이보다 빠르게 아래로 튕기면 닫는다.
 *
 * ⚠️ 단위는 **dp/초**다. gesture-handler 가 주는 그대로 쓴다 — 예전 `PanResponder` 는
 * dp/밀리초였고, 그때 쓰던 `0.7` 을 그대로 뒀다면 사실상 어떤 손짓도 못 넘는 문턱이 된다.
 */
export const DISMISS_VELOCITY = 700;

/**
 * 시트를 손가락 따라 얼마나 내릴까. 위로는 안 따라간다 — 시트가 위로 뜨면 아래에 배경이 비친다.
 *
 * ⚠️ 위로 올라갔을 때 **0 을 돌려줘야지 "값을 안 바꿈"이면 안 된다.** 이벤트는 프레임 단위로
 * 띄엄띄엄 와서, 아래로 끌다가 위로 빠르게 되돌리면 40 → -20 처럼 건너뛴다.
 * 그때 값을 그대로 두면 시트가 36dp 내려간 채 **손가락을 놓친다.**
 */
export function dragOffset(translationY: number): number {
  return Math.max(0, translationY);
}

/**
 * 손을 뗐을 때 닫을까.
 *
 * 거리 **또는** 속도, 둘 중 하나만 넘으면 된다 — 거리로만 재면 짧고 빠르게 튕기는 손짓이
 * 안 먹고, 속도로만 재면 천천히 끝까지 끌어내려도 안 닫힌다.
 *
 * ⚠️ **속도 쪽에는 방향이 붙어야 한다.** 잡은 뒤에도 손가락은 시작점 위로 갈 수 있다.
 * 위로 올렸다가(-50) 아래로 튕기며 떼면 거리는 음수인데 속도만 크다 —
 * 방향을 안 보면 **화면에서 움직이지도 않은 시트가 사라진다.**
 */
export function shouldDismiss(translationY: number, velocityY: number): boolean {
  return translationY > DISMISS_DISTANCE || (translationY > 0 && velocityY > DISMISS_VELOCITY);
}
