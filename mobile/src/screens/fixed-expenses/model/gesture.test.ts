import { describe, it, expect } from 'vitest';
import {
  DISMISS_DISTANCE,
  DISMISS_VELOCITY,
  DRAG_START_SLOP,
  dragOffset,
  shouldDismiss,
  shouldStartDrag,
} from './gesture';

describe('고정비 아래 시트 — 끌기 판정', () => {
  it('세로로 충분히 내려가면 끌기를 시작한다', () => {
    expect(shouldStartDrag(DRAG_START_SLOP + 1, 0)).toBe(true);
  });

  it('손 떨림만큼은 끌기가 아니다', () => {
    expect(shouldStartDrag(DRAG_START_SLOP, 0)).toBe(false);
    expect(shouldStartDrag(0, 0)).toBe(false);
  });

  it('위로 움직이는 손짓은 안 가져온다', () => {
    expect(shouldStartDrag(-30, 0)).toBe(false);
  });

  it('가로로 더 많이 움직이면 안 가져온다 — 분류 칩을 훑는 손짓이다', () => {
    expect(shouldStartDrag(10, 40)).toBe(false);
    expect(shouldStartDrag(10, -40)).toBe(false);
  });
});

describe('고정비 아래 시트 — 따라가는 거리', () => {
  it('잡히는 순간에는 0 에서 시작한다 — 톡 튀지 않는다', () => {
    expect(dragOffset(DRAG_START_SLOP)).toBe(0);
  });

  it('끌어내린 만큼 따라간다', () => {
    expect(dragOffset(DRAG_START_SLOP + 50)).toBe(50);
  });

  /*
    ↓ 코드 리뷰가 잡은 회귀. "위로 가면 값을 안 바꾼다" 로 두면 마지막 양수에 멈춰 있어서,
    move 이벤트가 40 → -20 으로 건너뛸 때 시트가 내려간 채 손가락을 놓친다.
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
    expect(shouldDismiss(30, 0.1)).toBe(false);
  });

  it('아래로 빠르게 튕기면 거리가 모자라도 닫는다', () => {
    expect(shouldDismiss(20, DISMISS_VELOCITY + 0.1)).toBe(true);
  });

  it('천천히 내리면 거리로 닫는다 — 속도가 0 이어도', () => {
    expect(shouldDismiss(200, 0)).toBe(true);
  });

  /*
    ↓ 코드 리뷰가 잡은 회귀. 속도 조건에 방향이 없으면 여기서 true 가 나온다.
    시트는 위로 안 따라가므로 화면상 제자리인데 그대로 닫혀버렸다.
  */
  it('위로 올렸다가 아래로 튕겨 떼면 안 닫는다 — 시트는 움직이지 않았다', () => {
    expect(shouldDismiss(-10, 1.5)).toBe(false);
    expect(shouldDismiss(-50, DISMISS_VELOCITY + 1)).toBe(false);
  });

  it('위로 빠르게 끌어올리는 것도 닫는 손짓이 아니다', () => {
    expect(shouldDismiss(-120, -2)).toBe(false);
  });
});
