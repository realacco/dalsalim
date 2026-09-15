// 기능: F-FAM-10
/**
 * 정산일 알림을 "지금 보낼 때인가" 판정하는 순수 함수들.
 *
 * 서버는 UTC 에 떠 있고 가족은 한국에 산다 — 판정은 전부 Asia/Seoul 로 바꿔서 한다.
 * 시간대를 사용자별로 두지 않는다. 이 앱의 가족은 한 나라에 산다.
 * prisma · fastify 를 임포트하지 않는다 (lib/shared 와 같은 급). 그래서 1층에서 잡힌다.
 */

export const SEOUL = 'Asia/Seoul';

export type LocalParts = {
  yearMonth: string;
  day: number;
  hour: number;
  minute: number;
  daysInMonth: number;
};

/** UTC 시각을 한국 시간의 날짜·시각으로. `daysInMonth` 는 말일 보정에 쓴다 */
export function localParts(now: Date, timeZone: string = SEOUL): LocalParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    // hour12: false 는 자정을 "24" 로 찍는 엔진이 있다. h23 이 0~23 을 보장한다
    hourCycle: 'h23',
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  const { year, month, day, hour, minute } = parts;
  // "다음 달 0일" = 이번 달 말일. Date.UTC 라 서버의 시간대에 안 흔들린다
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    yearMonth: `${year}-${String(month).padStart(2, '0')}`,
    day,
    hour,
    minute,
    daysInMonth,
  };
}

export type Settlement = { day: number; hour: number; minute: number };

/** Membership 의 정산일 칸 셋. 셋 다 null 이면 안 받는다 */
export type SettlementFields = {
  settlementDay: number | null;
  settlementHour: number | null;
  settlementMinute: number | null;
};

/** 응답에 실을 모양. 셋 중 하나라도 비어 있으면 "안 정함" — 반쪽짜리 설정을 밖으로 내보내지 않는다 */
export function settlementOf(m: SettlementFields): Settlement | null {
  if (m.settlementDay === null || m.settlementHour === null || m.settlementMinute === null) {
    return null;
  }
  return { day: m.settlementDay, hour: m.settlementHour, minute: m.settlementMinute };
}

/** 31일로 정한 사람에게 2월은 28일이 정산일이다 */
export function effectiveDay(day: number, daysInMonth: number): number {
  return Math.min(day, daysInMonth);
}

/**
 * 지금 보낼 때인가.
 *
 * 오늘이 정산일(말일 보정)이고 · 정한 시각이 **지났고** · 이번 달에 아직 안 보냈으면 참이다.
 * "지났고" 인 이유: 서버가 잠깐 죽어 정각을 놓쳐도 같은 날 안이면 살아나서 보낸다.
 * 날이 바뀌면 거짓 — 26일 아침에 "25일 정산일이에요" 는 소음이다.
 */
export function isSettlementDue(
  m: SettlementFields & { settlementNotifiedFor: string | null },
  now: LocalParts,
): boolean {
  const settlement = settlementOf(m);
  if (!settlement) return false;
  if (m.settlementNotifiedFor === now.yearMonth) return false;
  if (effectiveDay(settlement.day, now.daysInMonth) !== now.day) return false;
  return settlement.hour * 60 + settlement.minute <= now.hour * 60 + now.minute;
}
