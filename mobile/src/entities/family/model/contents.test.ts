import { describe, it, expect } from 'vitest';
import { contentsLine } from './contents';

describe('★ F-FAM-11 contentsLine — 가족을 없앨 때 사라지는 것', () => {
  it('아직 못 받았으면 아무 말도 안 한다', () => {
    expect(contentsLine(null)).toBe('');
  });

  it('둘 다 없으면 빈 문장이다 — "0개가 사라져요" 는 겁만 준다', () => {
    expect(contentsLine({ months: 0, fixedExpenses: 0 })).toBe('');
  });

  it('있는 것만 센다', () => {
    expect(contentsLine({ months: 7, fixedExpenses: 0 })).toBe(
      '\n기록한 달 7개월도 함께 지워져요.',
    );
    expect(contentsLine({ months: 0, fixedExpenses: 9 })).toBe('\n고정비 9개도 함께 지워져요.');
  });

  it('둘 다 있으면 가운뎃점으로 잇는다', () => {
    expect(contentsLine({ months: 7, fixedExpenses: 9 })).toBe(
      '\n기록한 달 7개월 · 고정비 9개도 함께 지워져요.',
    );
  });

  it('받침에 따라 변하는 조사를 붙이지 않는다 — 끝나는 항목이 달라도 문장이 같다', () => {
    for (const line of [
      contentsLine({ months: 1, fixedExpenses: 0 }),
      contentsLine({ months: 0, fixedExpenses: 1 }),
      contentsLine({ months: 1, fixedExpenses: 1 }),
    ]) {
      expect(line.endsWith('도 함께 지워져요.')).toBe(true);
    }
  });
});
