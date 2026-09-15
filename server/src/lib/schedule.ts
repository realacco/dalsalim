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
 * 정산일을 바꿔 저장할 때 "이번 달에 보냈다" 표시를 어떻게 이어갈지.
 *
 *  - 이미 이번 달에 받았고 새 정산일도 **오늘**이면 표시를 둔다 — 아침에 받고 저녁으로 옮겼다고 또 오면 안 된다.
 *    저장할 때 "이미 지났다"고 건너뛴 표시도 같게 본다 — 그날 시각을 다시 고쳐도 이번 달은 안 온다.
 *    둘을 가르려면 칸이 하나 더 필요한데, 다른 날로 옮기면 오는 것으로 충분해 그만한 값이 아니다
 *  - 오늘이 새 정산일이고 시각이 이미 지났으면 이번 달은 보낸 것으로 적는다 — 저장하자마자 튀어나오는 건 놀람이다
 *  - 그 밖에는 지운다 — 5일에 받은 사람이 25일로 옮기면 25일에 다시 온다. 날을 옮긴 건 다시 받겠다는 뜻이다
 *  - **안 받기(`null`)는 표시를 건드리지 않는다.** 정산일이 없으면 어차피 안 읽히는 값이라 지워서 얻는 것이 없고,
 *    지우면 「안 받기 → 같은 날 다시 정하기」로 그 달 알림이 두 번 간다. 위의 첫 줄이 막으려던 바로 그 일이
 *    한 단계를 거쳤다는 이유로 뚫리는 셈이다. 정의서도 같은 축이다 — 기기가 하나도 없어도 보낸 것으로 적고,
 *    나갔다 다시 승인돼도 표시가 남아 승인되자마자 튀어나오지 않는다. 지난 달 표시는 어차피 이번 달 판정에 안 걸린다
 */
export function carriedNotifiedFor(
  previous: string | null,
  fields: SettlementFields,
  now: LocalParts,
): string | null {
  const settlement = settlementOf(fields);
  if (!settlement) return previous;
  const sameDayAlreadyNotified =
    previous === now.yearMonth && effectiveDay(settlement.day, now.daysInMonth) === now.day;
  if (sameDayAlreadyNotified) return previous;
  return isSettlementDue({ ...fields, settlementNotifiedFor: null }, now) ? now.yearMonth : null;
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
