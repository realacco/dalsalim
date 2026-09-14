import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  CATEGORIES as SERVER_CATEGORIES,
  LINE_KINDS as SERVER_LINE_KINDS,
  currentYearMonth as serverCurrentYearMonth,
  defaultSettles as serverDefaultSettles,
  needsReason as serverNeedsReason,
  settlementOverspend as serverSettlementOverspend,
  shiftYearMonth as serverShiftYearMonth,
} from '../../server/src/lib/shared.js';

import { needsReason as appNeedsReason } from '../../mobile/src/entities/entry/model/reason';
import { settlementDelta as appSettlementDelta } from '../../mobile/src/entities/entry/model/settlement';
import { defaultSettles as appDefaultSettles } from '../../mobile/src/entities/fixed-expense/model/settles';
import {
  currentYearMonth as appCurrentYearMonth,
  shiftYearMonth as appShiftYearMonth,
} from '../../mobile/src/shared/lib/format';
import { CATEGORIES as APP_CATEGORIES, type LineKind } from '../../mobile/src/shared/model/types';

/**
 * ★ 서버와 앱에 **각각** 있는 같은 규칙이 진짜 같은지 본다.
 *
 * CLAUDE.md 는 "서버 규칙이 바뀌면 앱 쪽 사본도 같이 바꾼다"고 적어뒀지만,
 * 지켜졌는지 확인할 방법이 없었다. 한쪽만 고치면 아무 경고 없이 갈라지고,
 * 그 결과는 "저장은 되는데 [다음] 이 안 눌린다"처럼 원인을 찾기 어려운 형태로 나타난다.
 *
 * 이 파일이 그 유일한 자동 장치다. 사본을 하나 더 만들면 여기에 케이스도 같이 늘린다.
 */

const AMOUNTS: (number | null)[] = [null, 0, 1, 120000, 135000, -5000];
// 앱의 LineKind 유니온을 키로 받는다 — 앱에만 종류가 늘면 타입이, 서버에만 늘면 아래 케이스가 잡는다
const APP_LINE_KINDS: Record<LineKind, true> = {
  SETTLEMENT: true,
  INCOME: true,
  EXTRA_INCOME: true,
  FIXED: true,
  EXTRA: true,
};
const KINDS = Object.keys(APP_LINE_KINDS) as LineKind[];

describe('LINE_KINDS — 서버 배열과 앱 유니온이 같다', () => {
  it('종류 목록이 한쪽에만 늘지 않는다', () => {
    expect([...SERVER_LINE_KINDS].sort()).toEqual([...KINDS].sort());
  });
});

describe('needsReason — 서버와 앱이 같은 답을 낸다 (하드룰 2·3)', () => {
  it('종류 5 × 금액 조합 36 = 180가지에서 결과가 하나도 갈리지 않는다', () => {
    const mismatched: string[] = [];

    for (const kind of KINDS) {
      for (const plannedAmount of AMOUNTS) {
        for (const actualAmount of AMOUNTS) {
          const line = { kind, plannedAmount, actualAmount };
          const server = serverNeedsReason(line);
          const app = appNeedsReason(line);
          if (server !== app) {
            mismatched.push(
              `(${kind} 기본값 ${plannedAmount}, 금액 ${actualAmount}) 서버 ${server} · 앱 ${app}`,
            );
          }
        }
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('두 구현 모두 하드룰 그대로 판정한다', () => {
    for (const judge of [serverNeedsReason, appNeedsReason]) {
      const fixed = (plannedAmount: number | null, actualAmount: number | null) =>
        judge({ kind: 'FIXED', plannedAmount, actualAmount });
      expect(fixed(120000, 120000)).toBe(false);
      expect(fixed(120000, 135000)).toBe(true);
      expect(fixed(120000, 0)).toBe(true);
      expect(fixed(null, 135000)).toBe(false);
      expect(fixed(120000, null)).toBe(false);
      // 결산 줄은 양쪽 다 안 묻는다 — 한쪽만 물으면 "저장은 되는데 [다음] 이 안 눌린다" 가 된다
      expect(judge({ kind: 'SETTLEMENT', plannedAmount: 500000, actualAmount: 350000 })).toBe(
        false,
      );
    }
  });
});

describe('shiftYearMonth — 서버와 앱이 같은 달을 가리킨다', () => {
  it('49개월 범위에서 결과가 하나도 갈리지 않는다', () => {
    const mismatched: string[] = [];

    for (const base of ['2024-01', '2026-09', '2026-12']) {
      for (let months = -24; months <= 24; months += 1) {
        const server = serverShiftYearMonth(base, months);
        const app = appShiftYearMonth(base, months);
        if (server !== app) mismatched.push(`${base} ${months}개월 → 서버 ${server} · 앱 ${app}`);
      }
    }

    expect(mismatched).toEqual([]);
  });
});

describe('CATEGORIES — 분류 목록이 양쪽에서 같다', () => {
  it('★ 순서까지 같다 — 순서가 다르면 화면과 저장값이 어긋난다', () => {
    expect([...APP_CATEGORIES]).toEqual([...SERVER_CATEGORIES]);
  });

  it('한쪽에만 있는 분류가 없다', () => {
    const server = new Set<string>(SERVER_CATEGORIES);
    const app = new Set<string>(APP_CATEGORIES);
    expect([...server].filter((c) => !app.has(c))).toEqual([]);
    expect([...app].filter((c) => !server.has(c))).toEqual([]);
  });
});

describe('currentYearMonth — 서버와 앱이 같은 "이번 달"을 본다', () => {
  afterEach(() => vi.useRealTimers());

  it('연말 · 연초 · 한가운데에서 결과가 같다', () => {
    for (const at of [new Date(2026, 0, 1), new Date(2026, 8, 4), new Date(2026, 11, 31, 23, 59)]) {
      vi.useFakeTimers();
      vi.setSystemTime(at);
      expect(appCurrentYearMonth()).toBe(serverCurrentYearMonth());
      vi.useRealTimers();
    }
  });
});

describe('defaultSettles — 결산 스위치 기본값이 서버와 앱에서 같다', () => {
  it('모든 분류에서 결과가 갈리지 않는다', () => {
    const mismatched = [...SERVER_CATEGORIES].filter(
      (category) => serverDefaultSettles(category) !== appDefaultSettles(category),
    );
    expect(mismatched).toEqual([]);
  });

  it('두 구현 모두 생활비만 켠다 — 등록 시트가 켠 것과 서버가 저장한 것이 같아야 한다', () => {
    for (const judge of [serverDefaultSettles, appDefaultSettles]) {
      expect(judge('생활비')).toBe(true);
      expect(judge('통신')).toBe(false);
      expect(judge('저축')).toBe(false);
      expect(judge('기타')).toBe(false);
    }
  });
});

describe('결산 차액 — 서버가 남은 돈에서 빼는 금액과 앱이 화면에 말하는 금액이 같다', () => {
  // 같은 함수가 아니라 같은 규칙이다. 서버 settlementOverspend 는 "더 쓴 만큼만 뺀다" 의 합계 쪽,
  // 앱 settlementDelta 는 "N원 더 썼어요 · 남은 돈에서 빠져요" 의 화면 쪽. 한쪽만 바뀌면
  // 힌트가 말한 금액과 요약이 실제로 뺀 금액이 조용히 갈린다.
  const PLANNED = [1, 300000, 500000];
  // null(아직 안 적음)이 제일 위험한 칸이다 — 한쪽이 "옮긴 만큼 다 썼다" 로 읽으면 남은 돈이 조용히 틀어진다
  const ACTUAL: (number | null)[] = [null, 0, 1, 250000, 300000, 350000, 500000, 620000];

  it('더 쓴 경우에만 서버가 빼고, 빼는 금액이 앱이 말하는 금액과 같다 — 안 적은 줄은 양쪽 다 0', () => {
    const mismatched: string[] = [];

    for (const plannedAmount of PLANNED) {
      for (const actualAmount of ACTUAL) {
        const server = serverSettlementOverspend({
          kind: 'SETTLEMENT',
          plannedAmount,
          actualAmount,
        });
        const app = appSettlementDelta(plannedAmount, actualAmount);
        const appOver = app.kind === 'over' ? app.amount : 0;
        if (server !== appOver) {
          mismatched.push(
            `(옮긴 ${plannedAmount}, 실제 ${actualAmount}) 서버 ${server} · 앱 ${appOver}`,
          );
        }
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('덜 쓴 것은 양쪽 다 남은 돈에 더하지 않는다', () => {
    expect(
      serverSettlementOverspend({
        kind: 'SETTLEMENT',
        plannedAmount: 300000,
        actualAmount: 250000,
      }),
    ).toBe(0);
    expect(appSettlementDelta(300000, 250000)).toEqual({ kind: 'under', amount: 50000 });
  });
});
