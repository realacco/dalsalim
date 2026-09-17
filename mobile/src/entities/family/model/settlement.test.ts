import { describe, expect, it } from 'vitest';

import {
  SETTLEMENT_DAY_ROWS,
  SETTLEMENT_TIME_PRESETS,
  formatPreset,
  formatSettlement,
  formatTime,
  passedMonthHint,
  shortMonthHint,
  stepTime,
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

  it('29일부터는 짧은 달 안내가 붙는다', () => {
    expect(shortMonthHint(28)).toBeNull();
    expect(shortMonthHint(29)).not.toBeNull();
    expect(shortMonthHint(31)).not.toBeNull();
  });

  it('이번 달에 이미 갔거나 건너뛴 달이면 "다음 달부터" 안내가 붙는다', () => {
    expect(passedMonthHint('2026-09', '2026-09')).not.toBeNull();
    expect(passedMonthHint('2026-08', '2026-09')).toBeNull();
    expect(passedMonthHint(null, '2026-09')).toBeNull();
  });
});

describe('F-FAM-10 정산일 고르기', () => {
  it('날짜는 7칸 격자에 1일부터 31일까지 빠짐없이 한 번씩 — 모자란 칸은 빈 칸', () => {
    expect(SETTLEMENT_DAY_ROWS.every((row) => row.length === 7)).toBe(true);
    expect(SETTLEMENT_DAY_ROWS.flat().filter((day) => day !== null)).toEqual(
      Array.from({ length: 31 }, (_, i) => i + 1),
    );
  });

  it('시각은 30분씩 옮긴다', () => {
    expect(stepTime(9, 0, 1)).toEqual({ hour: 9, minute: 30 });
    expect(stepTime(9, 30, 1)).toEqual({ hour: 10, minute: 0 });
    expect(stepTime(9, 0, -1)).toEqual({ hour: 8, minute: 30 });
  });

  it('자정을 넘으면 반대편으로 돈다', () => {
    expect(stepTime(23, 30, 1)).toEqual({ hour: 0, minute: 0 });
    expect(stepTime(0, 0, -1)).toEqual({ hour: 23, minute: 30 });
  });

  it('칸 사이 값(9:15)은 누른 방향의 가까운 칸으로 붙는다 — 한 칸을 건너뛰지 않는다', () => {
    expect(stepTime(9, 15, 1)).toEqual({ hour: 9, minute: 30 });
    expect(stepTime(9, 15, -1)).toEqual({ hour: 9, minute: 0 });
  });

  it('자주 고를 시각은 하루의 때로 말하고 정각이다', () => {
    expect(SETTLEMENT_TIME_PRESETS.map(formatPreset)).toEqual([
      '아침 9시',
      '점심 12시',
      '저녁 6시',
      '밤 9시',
    ]);
  });
});
