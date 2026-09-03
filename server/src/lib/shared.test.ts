import { describe, it, expect } from 'vitest';
import {
  ACTIVE_MEMBER,
  CATEGORIES,
  LINE_KINDS,
  MEMBERSHIP_STATUSES,
  isYearMonth,
  needsReason,
  shiftYearMonth,
} from './shared.js';

/**
 * 하드룰 2·3 의 판정 함수. 줄 저장과 제출 양쪽이 이 하나를 본다.
 * 여기가 조용히 바뀌면 "차이에만 이유를 묻는다"는 제품의 정체성이 무너진다.
 */
describe('needsReason — 사유 강제 (하드룰 2·3)', () => {
  it('기본값과 금액이 같으면 아무것도 묻지 않는다', () => {
    expect(needsReason(120000, 120000)).toBe(false);
  });

  it('★ 금액이 달라지면 사유가 필요하다', () => {
    expect(needsReason(120000, 135000)).toBe(true);
    expect(needsReason(120000, 90000)).toBe(true);
  });

  it('★ 되돌리면 다시 필요 없어진다 — 사유도 같이 지워야 한다는 근거', () => {
    expect(needsReason(120000, 135000)).toBe(true);
    expect(needsReason(120000, 120000)).toBe(false);
  });

  it('기본값이 없는 첫 달은 비교 대상이 없으므로 묻지 않는다', () => {
    expect(needsReason(null, 135000)).toBe(false);
  });

  it('아직 금액을 적지 않았으면 묻지 않는다', () => {
    expect(needsReason(120000, null)).toBe(false);
  });

  it('★ 0 원과 안 적은 것(null)은 다르다', () => {
    // 0 으로 적은 것은 "이번 달엔 안 냈다"는 기록이다. 비교 대상이 있으므로 사유를 받는다
    expect(needsReason(120000, 0)).toBe(true);
    expect(needsReason(0, 0)).toBe(false);
    expect(needsReason(0, null)).toBe(false);
    expect(needsReason(null, 0)).toBe(false);
  });
});

describe('isYearMonth', () => {
  it('YYYY-MM 만 통과시킨다', () => {
    expect(isYearMonth('2026-09')).toBe(true);
    expect(isYearMonth('2026-01')).toBe(true);
    expect(isYearMonth('2026-12')).toBe(true);
  });

  it('없는 달과 형식이 어긋난 것을 막는다', () => {
    expect(isYearMonth('2026-00')).toBe(false);
    expect(isYearMonth('2026-13')).toBe(false);
    expect(isYearMonth('2026-9')).toBe(false);
    expect(isYearMonth('26-09')).toBe(false);
    expect(isYearMonth('2026-09-01')).toBe(false);
    expect(isYearMonth('')).toBe(false);
  });
});

describe('shiftYearMonth', () => {
  it('같은 해 안에서 옮긴다', () => {
    expect(shiftYearMonth('2026-09', 1)).toBe('2026-10');
    expect(shiftYearMonth('2026-09', -1)).toBe('2026-08');
    expect(shiftYearMonth('2026-09', 0)).toBe('2026-09');
  });

  it('★ 연말·연초를 넘어간다 — 프리필이 12월에서 1월로 넘어갈 때 쓰인다', () => {
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
  });

  it('한 자리 달에 0 을 붙인다', () => {
    expect(shiftYearMonth('2026-09', -8)).toBe('2026-01');
    expect(shiftYearMonth('2026-12', -3)).toBe('2026-09');
  });

  it('12 개월 단위로 옮기면 달은 그대로다', () => {
    expect(shiftYearMonth('2026-09', 12)).toBe('2027-09');
    expect(shiftYearMonth('2026-09', -24)).toBe('2024-09');
  });
});

describe('공유 상수', () => {
  it('분류는 9개이고 순서가 화면 순서다', () => {
    expect(CATEGORIES).toHaveLength(9);
    expect(CATEGORIES[0]).toBe('주거');
    expect(CATEGORIES[CATEGORIES.length - 1]).toBe('기타');
  });

  it("분류 이름은 '생활' 이 아니라 '생활비' 다", () => {
    // 한 번 '생활' → '생활비' 로 고쳤다. 되돌아가면 과거 기록의 분류가 뜨지 않는다
    expect(CATEGORIES).toContain('생활비');
    expect(CATEGORIES as readonly string[]).not.toContain('생활');
  });

  it('줄 종류는 수입 · 고정비 · 추가지출 셋뿐이다', () => {
    expect(LINE_KINDS).toEqual(['INCOME', 'FIXED', 'EXTRA']);
  });

  it('★ 가계부를 볼 수 있는 멤버십은 ACTIVE 하나뿐이다 (하드룰 8)', () => {
    // 코드를 맞힌 것만으로는 PENDING 이고, 내보낸 사람은 LEFT 로 남는다.
    // 정원 · 목록 · 권한이 전부 ACTIVE_MEMBER 하나만 봐야 어긋나지 않는다
    expect(ACTIVE_MEMBER).toEqual({ status: 'ACTIVE' });
    expect(MEMBERSHIP_STATUSES).toEqual(['PENDING', 'ACTIVE', 'LEFT']);
  });
});
