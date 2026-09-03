import { describe, it, expect } from 'vitest';
import {
  currentYearMonth,
  digitsOnly,
  formatAmount,
  formatClock,
  formatDelta,
  formatMonthShort,
  formatWon,
  formatYearMonth,
  parseAmount,
  shiftYearMonth,
  toAmountText,
} from './format';

describe('금액 표기', () => {
  it('3자리마다 콤마를 넣는다', () => {
    expect(formatAmount(8000000)).toBe('8,000,000');
    expect(formatAmount(0)).toBe('0');
    expect(formatAmount(999)).toBe('999');
  });

  it("'원' 을 붙인다", () => {
    expect(formatWon(120000)).toBe('120,000원');
  });
});

describe('formatDelta — 지난달과의 차이', () => {
  it('같으면 숫자를 보여주지 않는다', () => {
    // 0 을 '+0' 으로 쓰면 "안 변한 것"이 변화처럼 읽힌다
    expect(formatDelta(0)).toBe('-');
  });

  it('늘었으면 +, 줄었으면 − (하이픈이 아니라 진짜 빼기 기호)', () => {
    expect(formatDelta(15000)).toBe('+15,000');
    expect(formatDelta(-15000)).toBe('−15,000');
  });
});

describe('입력값 가공 — 시행착오 1-1 이 난 자리', () => {
  it('숫자가 아닌 것을 전부 버린다', () => {
    expect(digitsOnly('8,000,000원')).toBe('8000000');
    expect(digitsOnly('abc')).toBe('');
  });

  it('빈 입력은 0 이다', () => {
    expect(parseAmount('')).toBe(0);
    expect(parseAmount('abc')).toBe(0);
  });

  it('콤마가 붙은 문자열을 되돌린다', () => {
    expect(parseAmount('8,000,000')).toBe(8000000);
  });

  it('★ 800000 을 넣으면 800,000 이다 — 8,000,000 이 되면 그 버그의 재발이다', () => {
    // 컨트롤드 입력에서 포맷을 매 글자마다 붙이다가 자릿수가 불어난 적이 있다.
    // 포맷은 포커스가 빠질 때만 붙이고, 그 왕복이 값을 바꾸지 않아야 한다
    expect(toAmountText(parseAmount('800000'))).toBe('800,000');
    expect(parseAmount(toAmountText(8000000))).toBe(8000000);
  });

  it('★ null 은 빈 칸이지 0 이 아니다', () => {
    // 안 적은 것과 0 원으로 적은 것은 사유 판정에서 갈린다 (needsReason)
    expect(toAmountText(null)).toBe('');
    expect(toAmountText(0)).toBe('0');
  });
});

describe('연월 표기', () => {
  it('사람이 읽는 형태로 바꾼다', () => {
    expect(formatYearMonth('2026-09')).toBe('2026년 9월');
    expect(formatYearMonth('2026-01')).toBe('2026년 1월');
    expect(formatMonthShort('2026-09')).toBe('9월');
  });

  it('현재 연월은 YYYY-MM 이다', () => {
    expect(currentYearMonth()).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
  });

  it('★ 연말·연초를 넘어간다', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftYearMonth('2026-09', -8)).toBe('2026-01');
  });
});

describe('formatClock', () => {
  it('시:분 으로 보여준다', () => {
    expect(formatClock(new Date(2026, 8, 3, 14, 26))).toMatch(/\d{1,2}:\d{2}/);
  });
});
