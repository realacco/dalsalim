// 기능: F-FAM-10
import type { Settlement } from '@/shared/model/types';

/**
 * 날짜 고르기는 **달력처럼 한 줄에 7개**다. 칩을 흘려 늘어놓으면 글자 폭마다 줄이 달리 끊겨
 * 25일을 찾으려면 눈으로 훑어야 한다 — 7칸 격자면 줄 번호로 짐작이 된다 (실사용 후기 2026-09-17).
 * 마지막 줄은 3칸이고 나머지는 null 이다 — 비워 두면 3칸이 줄 전체로 늘어나 칸 크기가 달라진다.
 */
export const SETTLEMENT_DAY_ROWS: (number | null)[][] = Array.from({ length: 5 }, (_, row) =>
  Array.from({ length: 7 }, (_, col) => row * 7 + col + 1).map((day) => (day <= 31 ? day : null)),
);

/** 화면은 30분 단위만 고른다. 서버는 분 단위까지 받지만 칸을 더 늘릴 이유가 없다 */
export const SETTLEMENT_STEP_MINUTES = 30;

/**
 * 자주 고를 시각. 칩 24개 + 분 칩 대신 이 넷과 [−][+] 로 고른다 — 한 번에 끝나는 사람이 대부분이고,
 * 나머지도 30분씩 옮기면 닿는다. 고를 수 있는 값의 범위는 예전과 같다 (30분 단위 하루 전체).
 */
export const SETTLEMENT_TIME_PRESETS = [
  { label: '아침', hour: 9 },
  { label: '점심', hour: 12 },
  { label: '저녁', hour: 18 },
  { label: '밤', hour: 21 },
] as const;

const DAY_MINUTES = 24 * 60;

/**
 * 시각을 30분 칸만큼 옮긴다. 자정을 넘으면 반대편으로 돈다 (오후 11:30 → 오전 12:00).
 *
 * 칸 사이에 있는 값(다른 기기·서버에서 9:15 로 저장된 경우)은 **가까운 칸으로 먼저 붙는다** —
 * [+] 는 9:30, [−] 는 9:00. 칸 하나를 건너뛰어 8:30 이 되면 누른 사람이 한 칸 잃는다.
 */
export function stepTime(
  hour: number,
  minute: number,
  steps: number,
): { hour: number; minute: number } {
  const now = hour * 60 + minute;
  const grid = SETTLEMENT_STEP_MINUTES;
  const base = steps > 0 ? Math.floor(now / grid) * grid : Math.ceil(now / grid) * grid;
  const next = (((base + steps * grid) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return { hour: Math.floor(next / 60), minute: next % 60 };
}

/** 처음 여는 시트의 기본값 — 월급날로 흔한 25일, 출근 전 아침 */
export const DEFAULT_SETTLEMENT: Settlement = { day: 25, hour: 9, minute: 0 };

function period(hour: number): { label: string; hour12: number } {
  return { label: hour < 12 ? '오전' : '오후', hour12: hour % 12 === 0 ? 12 : hour % 12 };
}

/** "아침 9시" — 자주 고를 시각 칩의 라벨. 오전·오후 대신 하루의 때로 말한다 */
export function formatPreset(preset: { label: string; hour: number }): string {
  return `${preset.label} ${period(preset.hour).hour12}시`;
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
