// 기능: F-FAM-10
import type { Settlement } from '@/shared/model/types';

/** 휠의 날짜 칸 — 1일부터 31일까지 */
export const SETTLEMENT_DAYS: number[] = Array.from({ length: 31 }, (_, i) => i + 1);

/** 화면은 30분 단위만 고른다. 서버는 분 단위까지 받지만 칸을 더 늘릴 이유가 없다 */
const STEP_MINUTES = 30;

/** 휠의 시각 칸 — 자정부터 30분씩 하루 전체(48칸) */
export const SETTLEMENT_TIMES: { hour: number; minute: number }[] = Array.from(
  { length: (24 * 60) / STEP_MINUTES },
  (_, i) => ({ hour: Math.floor((i * STEP_MINUTES) / 60), minute: (i * STEP_MINUTES) % 60 }),
);

/**
 * 지금 시각이 휠의 몇 번째 칸인가. 칸 사이 값(다른 기기·서버에서 9:15 로 저장된 경우)은
 * **가까운 칸**으로 붙인다 — 휠은 칸 위에만 멈추므로 어딘가에는 세워야 한다.
 * 23:45 처럼 마지막 칸을 넘는 값은 자정(0번)이 아니라 **마지막 칸**에 세운다 —
 * 시트를 열었을 뿐인데 날이 바뀐 것처럼 보이면 안 된다.
 */
export function timeIndex(hour: number, minute: number): number {
  const slot = Math.round((hour * 60 + minute) / STEP_MINUTES);
  return Math.min(slot, SETTLEMENT_TIMES.length - 1);
}

/**
 * 휠이 멈춘 자리가 몇 번째 칸인가. 스냅이 걸려 있어도 끝에서 살짝 넘치거나(바운스) 모자랄 수 있어
 * 반올림하고 목록 밖으로 안 나가게 묶는다. 화면이 아니라 계산이라 여기서 판정한다.
 */
export function wheelIndex(offsetY: number, itemHeight: number, count: number): number {
  const index = Math.round(offsetY / itemHeight);
  return Math.min(Math.max(index, 0), count - 1);
}

/** 처음 여는 시트의 기본값 — 월급날로 흔한 25일, 출근 전 아침 */
export const DEFAULT_SETTLEMENT: Settlement = { day: 25, hour: 9, minute: 0 };

function period(hour: number): { label: string; hour12: number } {
  return { label: hour < 12 ? '오전' : '오후', hour12: hour % 12 === 0 ? 12 : hour % 12 };
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
