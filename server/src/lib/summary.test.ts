import { describe, it, expect } from 'vitest';
import { type SummableLine, entrySummary, settlementOverspend } from './shared.js';

/**
 * 요약 · 추이 · 홈 카드 · 위저드 확인 화면이 전부 이 계산 하나를 본다.
 * services 안에 있을 때는 DB 를 띄워야 확인됐지만, lib 으로 내려오면서 1층에서 잡힌다.
 */
const line = (kind: string, actualAmount: number | null): SummableLine => ({
  kind,
  plannedAmount: null,
  actualAmount,
});
const settlement = (plannedAmount: number, actualAmount: number | null): SummableLine => ({
  kind: 'SETTLEMENT',
  plannedAmount,
  actualAmount,
});

describe('F-BOOK-02 entrySummary — 한 사람의 한 달 합계', () => {
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
      extraIncomeTotal: 0,
      fixedTotal: 655_000,
      extraTotal: 120_000,
      settlementTotal: 0,
      surplus: 2_225_000,
    });
  });

  it('줄이 하나도 없으면 전부 0 이다 — 아직 아무도 안 적은 달', () => {
    expect(entrySummary([])).toEqual({
      income: 0,
      extraIncomeTotal: 0,
      fixedTotal: 0,
      extraTotal: 0,
      settlementTotal: 0,
      surplus: 0,
    });
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

  it('INCOME · EXTRA_INCOME · FIXED · SETTLEMENT 가 아닌 것은 추가 지출로 센다', () => {
    // 줄 종류는 다섯뿐이라(LINE_KINDS) 나머지는 EXTRA 다
    expect(entrySummary([line('EXTRA', 30_000)]).extraTotal).toBe(30_000);
  });
});

describe('F-ENT-11 entrySummary — 지난달 결산이 남은 돈에 들어가는 방식', () => {
  const base = [line('INCOME', 3_000_000), line('FIXED', 500_000), line('EXTRA', 100_000)];

  it('★ 옮겨둔 것보다 더 쓴 만큼만 남은 돈에서 뺀다', () => {
    const summary = entrySummary([...base, settlement(500_000, 560_000)]);
    expect(summary.settlementTotal).toBe(60_000);
    expect(summary.surplus).toBe(2_400_000 - 60_000);
    // 결산 줄의 금액은 고정비에도 추가지출에도 섞이지 않는다 — 지난달에 이미 나간 돈이다
    expect(summary.fixedTotal).toBe(500_000);
    expect(summary.extraTotal).toBe(100_000);
  });

  it('★ 덜 썼다고 남은 돈이 늘지는 않는다 — 안 쓴 돈은 옮겨둔 통장에 그대로 있다', () => {
    const summary = entrySummary([...base, settlement(500_000, 350_000)]);
    expect(summary.settlementTotal).toBe(0);
    expect(summary.surplus).toBe(2_400_000);
  });

  it('옮긴 만큼 썼으면 0 이다 — 기본값 그대로 [다음] 을 누른 달', () => {
    expect(settlementOverspend(settlement(500_000, 500_000))).toBe(0);
  });

  it('아직 안 적은 결산 줄은 0 으로 센다 — 안 적은 것을 "다 썼다" 로 읽지 않는다', () => {
    expect(settlementOverspend(settlement(500_000, null))).toBe(0);
  });

  it('결산 줄이 아니면 0 이다 — 고정비 줄의 초과는 이미 fixedTotal 에 들어 있다', () => {
    expect(
      settlementOverspend({ kind: 'FIXED', plannedAmount: 500_000, actualAmount: 600_000 }),
    ).toBe(0);
  });

  it('여러 줄이면 더 쓴 것끼리만 더한다 — 덜 쓴 줄이 더 쓴 줄을 상쇄하지 않는다', () => {
    const summary = entrySummary([
      ...base,
      settlement(500_000, 550_000),
      settlement(200_000, 150_000),
      settlement(100_000, 130_000),
    ]);
    expect(summary.settlementTotal).toBe(80_000);
  });
});

describe('F-ENT-12 entrySummary — 기타 수입은 수입에 합산되고 따로도 보인다', () => {
  const base = [line('INCOME', 3_000_000), line('FIXED', 500_000)];

  it('★ 수입 = 월급 + 기타 수입, 남은 돈도 그만큼 는다', () => {
    const summary = entrySummary([...base, line('EXTRA_INCOME', 500_000)]);
    expect(summary.income).toBe(3_500_000);
    expect(summary.extraIncomeTotal).toBe(500_000);
    expect(summary.surplus).toBe(3_000_000);
  });

  it('기타 수입은 지출 어디에도 섞이지 않는다', () => {
    const summary = entrySummary([...base, line('EXTRA_INCOME', 500_000)]);
    expect(summary.fixedTotal).toBe(500_000);
    expect(summary.extraTotal).toBe(0);
  });

  it('기타 수입이 없으면 0 이다 — 화면이 이 값으로 "그중 기타 수입" 줄을 숨긴다', () => {
    expect(entrySummary(base).extraIncomeTotal).toBe(0);
  });

  it('여러 줄이면 더한다', () => {
    const summary = entrySummary([
      ...base,
      line('EXTRA_INCOME', 500_000),
      line('EXTRA_INCOME', 120_000),
    ]);
    expect(summary.extraIncomeTotal).toBe(620_000);
    expect(summary.income).toBe(3_620_000);
  });
});
