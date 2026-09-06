import { afterEach, describe, it, expect, vi } from 'vitest';

import {
  CATEGORIES as SERVER_CATEGORIES,
  currentYearMonth as serverCurrentYearMonth,
  needsReason as serverNeedsReason,
  shiftYearMonth as serverShiftYearMonth,
} from '../../server/src/lib/shared.js';

import { needsReason as appNeedsReason } from '../../mobile/src/entities/entry/model/reason';
import {
  currentYearMonth as appCurrentYearMonth,
  shiftYearMonth as appShiftYearMonth,
} from '../../mobile/src/shared/lib/format';
import { CATEGORIES as APP_CATEGORIES } from '../../mobile/src/shared/model/types';

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

describe('needsReason — 서버와 앱이 같은 답을 낸다 (하드룰 2·3)', () => {
  it('가능한 조합 36가지에서 결과가 하나도 갈리지 않는다', () => {
    const mismatched: string[] = [];

    for (const planned of AMOUNTS) {
      for (const actual of AMOUNTS) {
        const server = serverNeedsReason(planned, actual);
        const app = appNeedsReason(planned, actual);
        if (server !== app) {
          mismatched.push(`(기본값 ${planned}, 금액 ${actual}) 서버 ${server} · 앱 ${app}`);
        }
      }
    }

    expect(mismatched).toEqual([]);
  });

  it('두 구현 모두 하드룰 그대로 판정한다', () => {
    for (const judge of [serverNeedsReason, appNeedsReason]) {
      expect(judge(120000, 120000)).toBe(false);
      expect(judge(120000, 135000)).toBe(true);
      expect(judge(120000, 0)).toBe(true);
      expect(judge(null, 135000)).toBe(false);
      expect(judge(120000, null)).toBe(false);
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
