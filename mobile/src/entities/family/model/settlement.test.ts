import { describe, expect, it } from 'vitest';

import {
  SETTLEMENT_DAYS,
  SETTLEMENT_TIMES,
  formatSettlement,
  formatTime,
  passedMonthHint,
  timeIndex,
  wheelIndex,
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
