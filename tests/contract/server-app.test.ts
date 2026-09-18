import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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
import { displayName as serverDisplayName } from '../../server/src/lib/schemas.js';
import { effectiveDay as serverEffectiveDay } from '../../server/src/lib/schedule.js';

import { MONTH_END_HINT as appMonthEndHint } from '../../mobile/src/entities/family/model/settlement';
import { needsReason as appNeedsReason } from '../../mobile/src/entities/entry/model/reason';
import { palettes } from '../../mobile/src/shared/config/theme';
import { settlementDelta as appSettlementDelta } from '../../mobile/src/entities/entry/model/settlement';
import { defaultSettles as appDefaultSettles } from '../../mobile/src/entities/fixed-expense/model/settles';
import {
  NAME_MAX_LENGTH as APP_NAME_MAX_LENGTH,
  currentYearMonth as appCurrentYearMonth,
  shiftYearMonth as appShiftYearMonth,
  truncateText as appTruncateText,
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

/**
 * 앱의 `MONTH_END_HINT` 는 서버 규칙을 **문장으로 주장한다** — "그 달 말일에 알려드려요".
 * 앱에서 29일 문턱이 없어진 뒤로는 그 주장이 틀려지는 것을 잡는 것이 없다.
 *
 * 그래서 **양쪽을 같이** 본다. 서버만 보면 `schedule.test.ts` 와 중복이고 이 층의 축
 * (두 사본의 일치)도 아니다 — 앱 문구를 「다음 달에 알려드려요」로 바꿔도 안 걸린다.
 */
describe('말일 보정 — 앱이 말하는 것과 서버가 하는 것', () => {
  it('앱은 「말일」이라 말하고, 서버는 실제로 말일로 당긴다', () => {
    expect(appMonthEndHint).toContain('말일');
    expect(serverEffectiveDay(31, 28)).toBe(28);
    expect(serverEffectiveDay(31, 30)).toBe(30);
    // 앱이 「다음 달」이 아니라 「그 달」이라 말하는 근거 — 있는 날은 그대로다
    expect(appMonthEndHint).not.toContain('다음 달');
    expect(serverEffectiveDay(25, 31)).toBe(25);
  });
});

/**
 * 알림 아이콘 색은 app.json(네이티브 매니페스트)과 theme.ts 양쪽에 같은 값으로 산다.
 * 매니페스트가 TS 토큰을 못 읽어 두 곳이 될 수밖에 없는데, 토큰만 바꾸면 알림 아이콘 색이
 * 조용히 낡는다 — 그 갈라짐을 잡는 자동 장치가 이것 하나다. (app.config.js 주석 참조)
 */
describe('알림 아이콘 색 — app.json 과 theme 토큰이 같다', () => {
  it('expo-notifications 플러그인의 color 가 light primary 다', async () => {
    const appJson = JSON.parse(
      await readFile(join(import.meta.dirname, '../../mobile/app.json'), 'utf8'),
    ) as { expo: { plugins: (string | [string, { color?: string }])[] } };

    const plugin = appJson.expo.plugins.find(
      (entry): entry is [string, { color?: string }] =>
        Array.isArray(entry) && entry[0] === 'expo-notifications',
    );

    expect(plugin?.[1].color).toBe(palettes.light.primary);
  });
});

describe('이름 길이 한도 — 앱 NAME_MAX_LENGTH 와 서버 displayName zod', () => {
  it('앱 한도만큼은 서버가 받고, 한 글자 더는 거절한다', () => {
    expect(serverDisplayName.safeParse('가'.repeat(APP_NAME_MAX_LENGTH)).success).toBe(true);
    expect(serverDisplayName.safeParse('가'.repeat(APP_NAME_MAX_LENGTH + 1)).success).toBe(false);
  });

  it('앱이 기본값을 자른 결과는 이모지가 섞여도 서버가 받는다 — 길이를 같은 기준으로 센다', () => {
    const cut = appTruncateText('😀'.repeat(APP_NAME_MAX_LENGTH), APP_NAME_MAX_LENGTH);
    expect(serverDisplayName.safeParse(cut).success).toBe(true);
  });
});
