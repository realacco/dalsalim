import { describe, expect, it } from 'vitest';

import {
  formatHour,
  formatSettlement,
  formatTime,
  passedMonthHint,
  shortMonthHint,
} from './settlement';

describe('F-FAM-10 정산일 표시', () => {
  it('시각은 오전·오후 12시간제로 — 자정은 오전 12시, 정오는 오후 12시', () => {
    expect(formatTime(0, 0)).toBe('오전 12:00');
    expect(formatTime(9, 0)).toBe('오전 9:00');
    expect(formatTime(12, 30)).toBe('오후 12:30');
    expect(formatTime(20, 30)).toBe('오후 8:30');
    expect(formatHour(23)).toBe('오후 11시');
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
