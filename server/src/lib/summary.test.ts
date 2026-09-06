import { describe, it, expect } from 'vitest';
import { type SummableLine, entrySummary } from './shared.js';

/**
 * 요약 · 추이 · 홈 카드 · 위저드 확인 화면이 전부 이 계산 하나를 본다.
 * services 안에 있을 때는 DB 를 띄워야 확인됐지만, lib 으로 내려오면서 1층에서 잡힌다.
 */
const line = (kind: string, actualAmount: number | null): SummableLine => ({ kind, actualAmount });

describe('entrySummary — 한 사람의 한 달 합계', () => {
  it('수입에서 고정비와 추가 지출을 뺀 것이 남은 돈이다', () => {
    expect(
      entrySummary([
        line('INCOME', 3_000_000),
        line('FIXED', 600_000),
        line('FIXED', 55_000),
        line('EXTRA', 120_000),
      ]),
    ).toEqual({
      income: 3_000_000,
      fixedTotal: 655_000,
      extraTotal: 120_000,
      surplus: 2_225_000,
    });
  });

  it('줄이 하나도 없으면 전부 0 이다 — 아직 아무도 안 적은 달', () => {
    expect(entrySummary([])).toEqual({ income: 0, fixedTotal: 0, extraTotal: 0, surplus: 0 });
  });

  it('같은 종류가 여러 줄이면 더한다', () => {
    const summary = entrySummary([line('INCOME', 2_000_000), line('INCOME', 500_000)]);
    expect(summary.income).toBe(2_500_000);
  });

  it('★ 아직 안 적은 줄(null)은 0 으로 센다', () => {
    // 그래서 호출하는 쪽이 **제출된 기록만** 넘겨야 한다. 작성 중인 사람의 빈 줄을
    // 넣으면 "엄마 수입 0원"처럼 읽히는 거짓 숫자가 요약에 섞인다 (기획서 3장)
    const summary = entrySummary([line('INCOME', null), line('FIXED', 600_000)]);
    expect(summary.income).toBe(0);
    expect(summary.surplus).toBe(-600_000);
  });

  it('★ 쓴 돈이 번 돈보다 많으면 남은 돈이 음수다 — 화면이 붉게 칠할 근거', () => {
    const summary = entrySummary([line('INCOME', 1_000_000), line('FIXED', 1_500_000)]);
    expect(summary.surplus).toBe(-500_000);
  });

  it('INCOME 도 FIXED 도 아닌 것은 추가 지출로 센다', () => {
    // 줄 종류는 셋뿐이라(LINE_KINDS) 나머지는 EXTRA 다
    expect(entrySummary([line('EXTRA', 30_000)]).extraTotal).toBe(30_000);
  });
});
