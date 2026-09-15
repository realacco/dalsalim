// 기능: F-FAM-10
import type { Settlement } from '@/shared/model/types';

export const SETTLEMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
export const SETTLEMENT_HOURS = Array.from({ length: 24 }, (_, i) => i);
/** 화면은 30분 단위만 고른다. 서버는 분 단위까지 받지만 칸을 더 늘릴 이유가 없다 */
export const SETTLEMENT_MINUTES = [0, 30] as const;

/** 처음 여는 시트의 기본값 — 월급날로 흔한 25일, 출근 전 아침 */
export const DEFAULT_SETTLEMENT: Settlement = { day: 25, hour: 9, minute: 0 };

function period(hour: number): { label: string; hour12: number } {
  return { label: hour < 12 ? '오전' : '오후', hour12: hour % 12 === 0 ? 12 : hour % 12 };
}

/** "오전 9시" — 시각 칩의 라벨 */
export function formatHour(hour: number): string {
  const p = period(hour);
  return `${p.label} ${p.hour12}시`;
}

/** "오전 9:00" */
export function formatTime(hour: number, minute: number): string {
  const p = period(hour);
  return `${p.label} ${p.hour12}:${String(minute).padStart(2, '0')}`;
}

/** "매달 25일 · 오전 9:00" — 카드와 구성원 목록이 같은 문장을 쓴다 */
export function formatSettlement(settlement: Settlement): string {
  return `매달 ${settlement.day}일 · ${formatTime(settlement.hour, settlement.minute)}`;
}

/**
 * 이번 달 알림이 이미 갔거나, 오늘 지난 시각으로 정해 서버가 이번 달을 건너뛴 사람에게.
 * 둘 다 "이번 달엔 안 온다" 는 점이 같고, 카드가 "이날 알려드려요" 만 말하면 기다리게 된다.
 */
export function passedMonthHint(notifiedFor: string | null, yearMonth: string): string | null {
  return notifiedFor === yearMonth ? '이번 달 알림은 지났어요. 다음 달부터 알려드려요.' : null;
}

/** 29일 이상은 짧은 달에 그 달 말일로 보낸다 (서버 규칙). 고를 때 미리 알려준다 */
export function shortMonthHint(day: number): string | null {
  return day >= 29 ? '2월처럼 짧은 달에는 그 달 말일에 알려드려요.' : null;
}
