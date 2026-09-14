import { describe, it, expect } from 'vitest';
import { formatSettlementDelta, settledYearMonth, settlementDelta } from './settlement';

describe('F-ENT-11 settlementDelta — 옮긴 것과 얼마나 다른가', () => {
  it('아직 안 적었으면 empty', () => {
    expect(settlementDelta(300000, null)).toEqual({ kind: 'empty' });
  });

  it('옮긴 만큼 썼으면 same — 기본값 그대로 [다음] 을 누른 경우가 이것이다', () => {
    expect(settlementDelta(300000, 300000)).toEqual({ kind: 'same' });
  });

  it('★ 더 썼으면 over 와 그 차이 — 이 금액만 이번 달 남은 돈에서 빠진다', () => {
    expect(settlementDelta(300000, 350000)).toEqual({ kind: 'over', amount: 50000 });
  });

  it('★ 덜 썼으면 under 와 그 차이 — 남은 돈이 늘지는 않는다', () => {
    expect(settlementDelta(300000, 250000)).toEqual({ kind: 'under', amount: 50000 });
  });

  it('0 원으로 적으면 옮긴 금액 전부가 남은 것이다', () => {
    expect(settlementDelta(300000, 0)).toEqual({ kind: 'under', amount: 300000 });
  });
});

describe('F-ENT-11 settledYearMonth — 결산 줄이 가리키는 달', () => {
  it('기록의 달에서 한 달 전이다', () => {
    expect(settledYearMonth('2026-09')).toBe('2026-08');
  });

  it('1월이면 지난해 12월이다', () => {
    expect(settledYearMonth('2026-01')).toBe('2025-12');
  });
});

describe('F-ENT-11 formatSettlementDelta — 요약 카드의 차액 표기', () => {
  it('더 썼으면 + 부호, 덜 썼으면 − 부호', () => {
    expect(formatSettlementDelta(50000)).toBe('+50,000');
    expect(formatSettlementDelta(-50000)).toBe('−50,000');
  });

  it("0 은 '그대로' — 옮긴 만큼 썼다는 사실이 보여야 한다", () => {
    expect(formatSettlementDelta(0)).toBe('그대로');
  });
});
