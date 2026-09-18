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
 * 날짜가 휠의 몇 번째 칸인가. `SETTLEMENT_DAYS[i] === i + 1` 의 역함수를 **여기 한 곳에** 둔다 —
 * 시각 휠은 `timeIndex()` ↔ `SETTLEMENT_TIMES[index]` 로 양방향이 모여 있는데 날짜만
 * 역방향이 화면의 산술로 흩어져 있었다. 목록을 바꾸면 두 방향이 같이 따라와야 한다.
 */
export function dayIndex(day: number): number {
  return clampIndex(day - 1, SETTLEMENT_DAYS.length);
}

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
  return clampIndex(Math.round(offsetY / itemHeight), count);
}

/**
 * 목록 밖으로 나가지 않게 묶는다. **끝 칸 처리가 여기 한 곳에만 있다** —
 * 굴려서 멈춘 자리와 스크린리더의 한 칸 이동이 같은 끝에서 멈추는 근거다.
 */
function clampIndex(index: number, count: number): number {
  return Math.min(Math.max(index, 0), count - 1);
}

/**
 * 시스템 글자 배율에 맞춘 휠의 칸 높이와 보이는 칸 수.
 *
 * 칸 높이만 dp 로 못 박으면 글자는 배율을 따라 커지는데 칸은 그대로라, 배율 1.8 쯤에서
 * 글자가 칸을 넘는다. 그래서 칸을 같이 키운다 (폭은 `adjustsFontSizeToFit` 이 맡는다 —
 * 그 프롭은 `numberOfLines=1` 에서 폭으로만 줄여 높이는 못 막는다).
 *
 * 대신 **보이는 칸 수를 줄여 판이 길어지는 것을 늦춘다.** 칸만 키우면 판이 그만큼 길어져
 * 큰 글자에서 시트가 화면을 넘는다 — 휠은 안쪽이 이미 세로 스크롤이라 바깥을 또
 * 스크롤로 감쌀 수 없어서, 높이를 늘리지 않는 것이 유일한 길이다.
 * 이웃 칸이 하나씩은 보여야 굴릴 수 있다는 게 읽히므로 3 아래로는 줄이지 않는다 —
 * 아주 큰 배율(2.7 쯤)에서는 상한을 넘는데, 그때는 시트가 **위로** 밀려 저장 버튼은 남는다.
 *
 * **디자인 토큰은 전부 인자로 받는다.** 여기 복사하면 `font.title` 을 고쳤을 때 칸 높이만
 * 조용히 어긋난다. `WHEEL_MAX_HEIGHT` 만 안에 있는 것은 그것이 토큰이 아니라 **이 함수의
 * 정책**이어서다 — 어느 화면의 값도 아니고 보이는 칸을 줄이는 기준일 뿐이다.
 *
 * `padOffset` 도 같이 돌려준다. 띠 위치와 휠의 위아래 여백이 **같은 값이어야만** 띠와 칸이
 * 맞는데, 화면 두 곳에서 같은 식을 따로 세우면 한쪽만 고쳐도 아무 경고 없이 어긋난다.
 */
export function wheelMetrics(
  fontScale: number,
  tokens: { touchSize: number; selectedLineHeight: number; padding: number },
): { itemHeight: number; visible: number; padOffset: number } {
  const itemHeight = Math.max(
    tokens.touchSize,
    Math.ceil(tokens.selectedLineHeight * fontScale) + tokens.padding,
  );
  const visible = itemHeight * 5 <= WHEEL_MAX_HEIGHT ? 5 : 3;
  return { itemHeight, visible, padOffset: itemHeight * ((visible - 1) / 2) };
}

/** 판이 이보다 길어지면 큰 글자에서 시트가 화면을 넘기 시작한다 */
const WHEEL_MAX_HEIGHT = 240;

/**
 * 스크린리더가 한 칸 올리거나 내릴 때의 다음 칸.
 * 굴릴 때와 **같은 `clampIndex()`** 를 지나므로 손가락으로 간 끝과 여기서 간 끝이 같다.
 */
export function stepIndex(index: number, step: number, count: number): number {
  return clampIndex(index + step, count);
}

/**
 * 손가락을 뗀 자리에서 고른 값을 확정해도 되나.
 *
 * `onScrollEndDrag` 는 **손가락을 뗀 순간**에 오고 그때 위치는 아직 날아가는 중이라,
 * 세게 튕기면 중간 칸이 한 번 잡혔다가 멈춘 뒤 다시 고쳐진다 — 미리보기가 깜빡인다.
 * 그렇다고 이 신호를 버릴 수도 없다. 느리게 놓으면 튕김이 없어서 `onMomentumScrollEnd`
 * 가 아예 안 온다. 그래서 **멈춘 채로 놓았을 때만** 여기서 확정한다.
 */
export function settlesOnDragEnd(velocityY: number | undefined): boolean {
  return Math.abs(velocityY ?? 0) < FLING_VELOCITY;
}

/**
 * 이보다 빠르면 아직 날아가는 중이다.
 * ⚠️ 단위가 플랫폼마다 다르다 — iOS 는 dp/ms 인데 안드로이드는 물리 픽셀/ms 를 그대로 싣는다.
 * 그래서 화면 배율이 큰 기기에서는 이 문턱이 실질적으로 더 낮게(느린 것도 「튕겼다」로) 걸린다.
 * 값이 빠지지는 않는다 — `snapToInterval` 이 켜져 있으면 안드로이드는 손을 뗄 때 늘 스냅
 * 애니메이션을 돌려 `onMomentumScrollEnd` 가 뒤따라오기 때문이다. 문턱을 다시 만질 때 이 차이를 본다.
 */
const FLING_VELOCITY = 0.1;

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

/**
 * 휠에 그리는 칸 글자. **한 번만 만든다** — 79개를 렌더마다 다시 만들면 값이 바뀔 때마다
 * 두 휠이 새 배열을 받고, 포맷팅이 JSX 안으로 들어가 「컴포넌트는 그리기만 한다」도 깨진다.
 */
export const SETTLEMENT_DAY_LABELS: string[] = SETTLEMENT_DAYS.map((day) => `${day}일`);
export const SETTLEMENT_TIME_LABELS: string[] = SETTLEMENT_TIMES.map((time) =>
  formatTime(time.hour, time.minute),
);
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
