import { describe, expect, it } from 'vitest';

import {
  carriedNotifiedFor,
  effectiveDay,
  isSettlementDue,
  localParts,
  settlementOf,
} from './schedule.js';

const setting = (day: number | null, hour = 9, minute = 0, notifiedFor: string | null = null) => ({
  settlementDay: day,
  settlementHour: day === null ? null : hour,
  settlementMinute: day === null ? null : minute,
  settlementNotifiedFor: notifiedFor,
});

describe('localParts — UTC 를 한국 시간으로', () => {
  it('UTC 23:30 은 한국의 다음 날 08:30 이다', () => {
    const parts = localParts(new Date('2026-09-14T23:30:00Z'));
    expect(parts).toEqual({ yearMonth: '2026-09', day: 15, hour: 8, minute: 30, daysInMonth: 30 });
  });

  it('자정은 24시가 아니라 0시다', () => {
    expect(localParts(new Date('2026-09-14T15:00:00Z')).hour).toBe(0);
  });

  it('2월의 말일을 안다 — 윤년 포함', () => {
    expect(localParts(new Date('2026-02-10T00:00:00Z')).daysInMonth).toBe(28);
    expect(localParts(new Date('2028-02-10T00:00:00Z')).daysInMonth).toBe(29);
  });
});

describe('★ F-FAM-10 isSettlementDue — 지금 보낼 때인가', () => {
  // 2030-02-28 09:30 KST (2월은 28일까지)
  const feb28 = localParts(new Date('2030-02-28T00:30:00Z'));

  it('오늘이 정산일이고 시각이 지났으면 보낸다', () => {
    expect(isSettlementDue(setting(28, 9, 0), feb28)).toBe(true);
  });

  it('정각도 "지난 것" 이다 — 정각에 도는 틱이 놓치지 않게', () => {
    expect(isSettlementDue(setting(28, 9, 30), feb28)).toBe(true);
  });

  it('시각 전이면 안 보낸다', () => {
    expect(isSettlementDue(setting(28, 10, 0), feb28)).toBe(false);
  });

  it('★ 31일로 정하면 짧은 달엔 말일에 보낸다', () => {
    expect(isSettlementDue(setting(31), feb28)).toBe(true);
    expect(effectiveDay(31, 28)).toBe(28);
    expect(effectiveDay(15, 28)).toBe(15);
  });

  it('다른 날이면 안 보낸다', () => {
    expect(isSettlementDue(setting(15), feb28)).toBe(false);
  });

  it('★ 이번 달에 이미 보냈으면 다시 안 보낸다 — 지난달에 보낸 표시는 막지 않는다', () => {
    expect(isSettlementDue(setting(28, 9, 0, '2030-02'), feb28)).toBe(false);
    expect(isSettlementDue(setting(28, 9, 0, '2030-01'), feb28)).toBe(true);
  });

  it('정하지 않았으면 안 보낸다', () => {
    expect(isSettlementDue(setting(null), feb28)).toBe(false);
  });
});

describe('★ F-FAM-10 carriedNotifiedFor — 정산일을 바꿀 때 "보냈다" 표시', () => {
  // 2030-02-28 09:30 KST
  const feb28 = localParts(new Date('2030-02-28T00:30:00Z'));
  const fields = (day: number, hour: number) => ({
    settlementDay: day,
    settlementHour: hour,
    settlementMinute: 0,
  });

  it('★ 이미 받은(또는 건너뛴) 날 안에서 시각만 늦추면 다시 안 온다', () => {
    expect(carriedNotifiedFor('2030-02', fields(28, 21), feb28)).toBe('2030-02');
    expect(carriedNotifiedFor('2030-02', fields(31, 21), feb28)).toBe('2030-02'); // 말일 보정도 같은 날
  });

  it('다른 날로 옮기면 그 날에 다시 온다', () => {
    expect(carriedNotifiedFor('2030-02', fields(5, 9), feb28)).toBeNull();
  });

  it('오늘로 정했는데 시각이 이미 지났으면 이번 달은 보낸 것으로 적는다', () => {
    expect(carriedNotifiedFor(null, fields(28, 9), feb28)).toBe('2030-02');
    expect(carriedNotifiedFor(null, fields(28, 10), feb28)).toBeNull();
  });

  const cleared = { settlementDay: null, settlementHour: null, settlementMinute: null };

  it('★ 안 받기를 해도 이번 달에 보냈다는 표시는 남는다', () => {
    // 정의서 — 기기가 없어도 · 나갔다 돌아와도 표시는 남는다. 상태가 바뀌었다고 그 달이 되살아나지 않는다
    expect(carriedNotifiedFor('2030-02', cleared, feb28)).toBe('2030-02');
    expect(carriedNotifiedFor(null, cleared, feb28)).toBeNull();
  });

  it('★ 안 받기를 거쳐 같은 날 다시 정해도 그 달엔 안 온다', () => {
    // 09:30 에 받은 사람이 안 받기를 눌렀다가 같은 날 21:00 으로 다시 정하는 길.
    // [바꾸기] 로 시각만 옮기면 안 오는데 이 길로는 오면, 같은 일이 경로에 따라 갈린다
    const afterClear = carriedNotifiedFor('2030-02', cleared, feb28);
    expect(carriedNotifiedFor(afterClear, fields(28, 21), feb28)).toBe('2030-02');
  });
});

describe('settlementOf — 응답 모양', () => {
  it('셋 다 있어야 정한 것이다', () => {
    expect(settlementOf({ settlementDay: 25, settlementHour: 9, settlementMinute: 30 })).toEqual({
      day: 25,
      hour: 9,
      minute: 30,
    });
    expect(
      settlementOf({ settlementDay: 25, settlementHour: null, settlementMinute: 0 }),
    ).toBeNull();
  });
});
