import { describe, expect, it } from 'vitest';

import {
  SETTLEMENT_DAYS,
  SETTLEMENT_DAY_LABELS,
  SETTLEMENT_TIMES,
  SETTLEMENT_TIME_LABELS,
  formatSettlement,
  formatTime,
  passedMonthHint,
  settlesOnDragEnd,
  snapSettlement,
  stepIndex,
  timeIndex,
  wheelIndex,
  wheelMetrics,
} from './settlement';

describe('F-FAM-10 정산일 표시', () => {
  it('시각은 오전·오후 12시간제로 — 자정은 오전 12시, 정오는 오후 12시', () => {
    expect(formatTime(0, 0)).toBe('오전 12:00');
    expect(formatTime(9, 0)).toBe('오전 9:00');
    expect(formatTime(12, 30)).toBe('오후 12:30');
    expect(formatTime(20, 30)).toBe('오후 8:30');
  });

  it('카드와 구성원 목록이 같은 문장을 쓴다', () => {
    expect(formatSettlement({ day: 25, hour: 9, minute: 0 })).toBe('매달 25일 · 오전 9:00');
  });

  it('★ F-FAM-10 글자를 키우면 칸도 커지되 보이는 칸을 줄여 판을 늦춘다', () => {
    const tokens = { touchSize: 44, selectedLineHeight: 28, padding: 8 };
    // 기본 배율에서는 터치 최소 크기 그대로, 위아래 두 칸씩 보인다
    expect(wheelMetrics(1, tokens)).toEqual({ itemHeight: 44, visible: 5, padOffset: 88 });
    // 글자가 커지면 칸도 커진다 — 안 그러면 선택 칸 글자가 칸을 넘는다
    expect(wheelMetrics(2, tokens).itemHeight).toBeGreaterThan(44);
    // 대신 보이는 칸을 줄여 판이 길어지는 것을 늦춘다
    expect(wheelMetrics(2, tokens).visible).toBe(3);
    // 가운데 칸이 있어야 하므로 짝수로 줄지 않고, 이웃이 보여야 하므로 3 아래로도 안 간다
    expect(wheelMetrics(3, tokens).visible).toBe(3);
    // 토큰을 바꾸면 따라간다 — 값을 복사해두면 여기가 안 움직인다
    expect(wheelMetrics(1, { ...tokens, selectedLineHeight: 40 }).itemHeight).toBe(48);
  });

  it('★ F-FAM-10 띠 위치와 휠 여백은 한 값에서 나온다', () => {
    // 둘이 같아야 띠와 칸이 맞는다 — 화면 두 곳에서 따로 세우면 한쪽만 고쳐도 조용히 어긋난다
    const { itemHeight, visible, padOffset } = wheelMetrics(2, {
      touchSize: 44,
      selectedLineHeight: 28,
      padding: 8,
    });
    expect(padOffset).toBe(itemHeight * ((visible - 1) / 2));
  });

  it('★ F-FAM-10 스크린리더의 한 칸 이동도 굴릴 때와 같은 끝에서 멈춘다', () => {
    expect(stepIndex(5, 1, 44, 31)).toBe(6);
    expect(stepIndex(5, -1, 44, 31)).toBe(4);
    // 끝에서 더 가려 해도 목록을 안 넘는다 — 굴릴 때와 같은 wheelIndex() 를 지난다
    expect(stepIndex(0, -1, 44, 31)).toBe(0);
    expect(stepIndex(30, 1, 44, 31)).toBe(30);
  });

  it('칸 글자는 한 번만 만들어 둔다', () => {
    expect(SETTLEMENT_DAY_LABELS).toHaveLength(SETTLEMENT_DAYS.length);
    expect(SETTLEMENT_DAY_LABELS[0]).toBe('1일');
    expect(SETTLEMENT_DAY_LABELS.at(-1)).toBe('31일');
    expect(SETTLEMENT_TIME_LABELS).toHaveLength(SETTLEMENT_TIMES.length);
    expect(SETTLEMENT_TIME_LABELS[0]).toBe('오전 12:00');
    expect(SETTLEMENT_TIME_LABELS.at(-1)).toBe('오후 11:30');
  });

  it('★ F-FAM-10 튕겨 놓은 손가락에서는 값을 확정하지 않는다', () => {
    // 멈춘 채로 놓으면 튕김이 없어 여기서 확정해야 한다
    expect(settlesOnDragEnd(0)).toBe(true);
    expect(settlesOnDragEnd(undefined)).toBe(true);
    // 날아가는 중이면 중간 칸이 잡혀 미리보기가 깜빡인다 — 멈출 때까지 기다린다
    expect(settlesOnDragEnd(1.2)).toBe(false);
    expect(settlesOnDragEnd(-1.2)).toBe(false);
  });

  it('★ F-FAM-10 칸 밖 시각으로 열면 휠이 서는 칸으로 맞춰 준다', () => {
    // 띠 안에 9:30 이 서는데 저장값이 9:15 로 남으면 한 화면에서 두 값이 보인다
    expect(snapSettlement({ day: 25, hour: 9, minute: 15 })).toEqual({
      day: 25,
      hour: 9,
      minute: 30,
    });
    // 마지막 칸을 넘는 값이 자정으로 돌아가면 날이 바뀐 것처럼 보인다
    expect(snapSettlement({ day: 1, hour: 23, minute: 45 })).toEqual({
      day: 1,
      hour: 23,
      minute: 30,
    });
    // 이미 칸 위에 있으면 건드리지 않는다
    expect(snapSettlement({ day: 31, hour: 9, minute: 0 })).toEqual({
      day: 31,
      hour: 9,
      minute: 0,
    });
  });

  it('이번 달에 이미 갔거나 건너뛴 달이면 "다음 달부터" 안내가 붙는다', () => {
    expect(passedMonthHint('2026-09', '2026-09')).not.toBeNull();
    expect(passedMonthHint('2026-08', '2026-09')).toBeNull();
    expect(passedMonthHint(null, '2026-09')).toBeNull();
  });
});

describe('F-FAM-10 정산일 고르기', () => {
  it('날짜 칸은 1일부터 31일까지 빠짐없이 한 번씩', () => {
    expect(SETTLEMENT_DAYS).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it('시각 칸은 자정부터 30분씩 하루 전체다', () => {
    expect(SETTLEMENT_TIMES).toHaveLength(48);
    expect(SETTLEMENT_TIMES[0]).toEqual({ hour: 0, minute: 0 });
    expect(SETTLEMENT_TIMES[18]).toEqual({ hour: 9, minute: 0 });
    expect(SETTLEMENT_TIMES[47]).toEqual({ hour: 23, minute: 30 });
  });

  it('칸 위의 시각은 그 칸을 가리킨다', () => {
    expect(timeIndex(0, 0)).toBe(0);
    expect(timeIndex(9, 0)).toBe(18);
    expect(timeIndex(23, 30)).toBe(47);
  });

  it('칸 사이 값은 가까운 칸으로 붙는다 — 마지막 칸을 넘어 자정으로 돌지 않는다', () => {
    expect(timeIndex(9, 14)).toBe(18);
    expect(timeIndex(9, 15)).toBe(19);
    expect(timeIndex(23, 45)).toBe(47);
  });

  it('휠이 멈춘 자리는 반올림하고 목록 밖으로 안 나간다', () => {
    expect(wheelIndex(0, 44, 31)).toBe(0);
    expect(wheelIndex(65, 44, 31)).toBe(1);
    expect(wheelIndex(90, 44, 31)).toBe(2);
    expect(wheelIndex(-20, 44, 31)).toBe(0);
    expect(wheelIndex(9999, 44, 31)).toBe(30);
  });
});
