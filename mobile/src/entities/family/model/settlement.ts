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

/**
 * 저장된 값을 휠 칸 위로 당긴다. 서버는 분을 0~59 로 받으므로 9:15 처럼 칸 밖 값이 올 수 있는데,
 * 그대로 열면 띠 안에는 9:30 이 서고 미리보기와 저장값은 9:15 인 채로 갈린다.
 * 게다가 휠을 9:30 칸에 맞춰도 이미 그 칸이라 아무 일도 안 일어나 빠져나올 길이 화면에 없다.
 * 열 때 한 번 맞춰두면 보이는 값과 저장되는 값이 처음부터 같다.
 */
export function snapSettlement(settlement: Settlement): Settlement {
  const time = SETTLEMENT_TIMES[timeIndex(settlement.hour, settlement.minute)];
  return { day: settlement.day, hour: time.hour, minute: time.minute };
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

/**
 * 그 날이 없는 달(2월·4월·6월·9월·11월)에는 말일로 당겨 보낸다는 서버 규칙을 그대로 말한다.
 * **날짜와 상관없이 항상 보인다** — 29일 이상일 때만 띄우면 안내가 있다 없다 하면서 판이 흔들리고,
 * 고를 때 안 보이던 문장이 뒤늦게 나타나는 게 오히려 낯설다.
 * 날짜를 문장에 넣지 않는 이유도 같다. 「고른 날」 한 마디면 31일이든 29일이든 같은 말이 된다.
 */
export const MONTH_END_HINT = '고른 날이 없는 달에는 그 달 말일에 알려드려요.';
