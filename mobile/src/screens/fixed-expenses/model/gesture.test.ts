import { describe, it, expect } from 'vitest';
import {
  DISMISS_DISTANCE,
  DISMISS_VELOCITY,
  DRAG_START_SLOP,
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
