import { describe, expect, it } from 'vitest';

import {
  SETTLEMENT_DAYS,
  SETTLEMENT_TIMES,
  formatSettlement,
  formatTime,
  passedMonthHint,
  snapSettlement,
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

  it('★ F-FAM-10 글자를 키우면 칸도 커지되 판 높이는 묶인다', () => {
    // 기본 배율에서는 터치 최소 크기 그대로, 위아래 두 칸씩 보인다
    expect(wheelMetrics(1, 44)).toEqual({ itemHeight: 44, visible: 5 });
    // 글자가 커지면 칸도 커진다 — 안 그러면 선택 칸 글자가 칸을 넘는다
    expect(wheelMetrics(2, 44).itemHeight).toBeGreaterThan(44);
    // 대신 보이는 칸을 줄여 판이 길어지지 않게 한다 (큰 글자에서 시트가 화면을 넘는다)
    expect(wheelMetrics(2, 44).visible).toBe(3);
    const tall = wheelMetrics(2, 44);
    expect(tall.itemHeight * tall.visible).toBeLessThanOrEqual(44 * 5 + 20);
    // 가운데 칸이 있어야 하므로 짝수로 줄지 않는다
    expect(wheelMetrics(3, 44).visible % 2).toBe(1);
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
