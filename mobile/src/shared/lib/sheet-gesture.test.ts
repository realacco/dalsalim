import { describe, it, expect } from 'vitest';
import { DISMISS_DISTANCE, DISMISS_VELOCITY, dragOffset, shouldDismiss } from './sheet-gesture';

describe('아래 시트 — 따라가는 거리', () => {
  /*
    ↓ translationY 는 손가락이 처음 닿은 곳부터의 거리다 (gesture-handler 는 잡히는 순간에도
    0 으로 안 되돌린다). 그래서 아무것도 빼지 않아야 시트가 손가락과 같이 움직인다.
  */
  it('잡힌 자리에서 0 으로 시작한다', () => {
    expect(dragOffset(0)).toBe(0);
  });

  it('끌어내린 만큼 그대로 따라간다 — 어긋나지 않는다', () => {
    expect(dragOffset(50)).toBe(50);
    expect(dragOffset(4)).toBe(4);
  });

  /*
    ↓ 코드 리뷰가 잡은 회귀. "위로 가면 값을 안 바꾼다" 로 두면 마지막 양수에 멈춰 있어서,
    이벤트가 40 → -20 으로 건너뛸 때 시트가 내려간 채 손가락을 놓친다.
  */
  it('위로 올리면 0 에 붙는다 — 내려간 채로 멈추지 않는다', () => {
    expect(dragOffset(-20)).toBe(0);
    expect(dragOffset(0)).toBe(0);
  });
});

describe('고정비 아래 시트 — 닫기 판정', () => {
  it('충분히 끌어내리면 닫는다', () => {
    expect(shouldDismiss(DISMISS_DISTANCE + 1, 0)).toBe(true);
  });

  it('조금 끌었다 놓으면 안 닫는다 — 제자리로 돌아간다', () => {
    expect(shouldDismiss(DISMISS_DISTANCE, 0)).toBe(false);
    expect(shouldDismiss(30, 100)).toBe(false);
  });

  it('아래로 빠르게 튕기면 거리가 모자라도 닫는다', () => {
    expect(shouldDismiss(20, DISMISS_VELOCITY + 1)).toBe(true);
  });

  it('천천히 내리면 거리로 닫는다 — 속도가 0 이어도', () => {
    expect(shouldDismiss(200, 0)).toBe(true);
  });

  /*
    ↓ 속도 임계값이 dp/초 라는 것을 못박는다. 예전 PanResponder 는 dp/밀리초였고,
    그때 쓰던 0.7 을 그대로 뒀다면 이 케이스가 통과해버려 손짓 하나로도 닫혔을 것이다.
  */
  it('사람이 낼 수 있는 느린 속도로는 안 닫힌다', () => {
    expect(shouldDismiss(10, 1)).toBe(false);
    expect(shouldDismiss(10, 300)).toBe(false);
  });

  /*
    ↓ 코드 리뷰가 잡은 회귀. 속도 조건에 방향이 없으면 여기서 true 가 나온다.
    시트는 위로 안 따라가므로 화면상 제자리인데 그대로 닫혀버렸다.
  */
  it('위로 올렸다가 아래로 튕겨 떼면 안 닫는다 — 시트는 움직이지 않았다', () => {
    expect(shouldDismiss(-10, 1500)).toBe(false);
    expect(shouldDismiss(-50, DISMISS_VELOCITY + 500)).toBe(false);
  });

  it('위로 빠르게 끌어올리는 것도 닫는 손짓이 아니다', () => {
    expect(shouldDismiss(-120, -2000)).toBe(false);
  });
});
