/** 금액·날짜 표기. 앱 전체가 이 함수들만 쓴다. */

export function formatAmount(value: number): string {
  return value.toLocaleString('ko-KR');
}

export function formatWon(value: number): string {
  return `${formatAmount(value)}원`;
}

/** 부호가 붙은 차액. 0 이면 '-' */
export function formatDelta(value: number): string {
  if (value === 0) return '-';
  return `${value > 0 ? '+' : '−'}${formatAmount(Math.abs(value))}`;
}

/** 숫자만 남긴다. 입력창에서 쓴다. */
export function digitsOnly(text: string): string {
  return text.replace(/[^0-9]/g, '');
}

export function parseAmount(text: string): number {
  const digits = digitsOnly(text);
  return digits ? Number(digits) : 0;
}

/** 입력창에 보여줄 3자리 콤마 문자열 */
export function toAmountText(value: number | null): string {
  if (value === null) return '';
  return formatAmount(value);
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function shiftYearMonth(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const zero = y * 12 + (m - 1) + months;
  return `${Math.floor(zero / 12)}-${String((zero % 12) + 1).padStart(2, '0')}`;
}

export function formatYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${y}년 ${Number(m)}월`;
}

export function formatMonthShort(yearMonth: string): string {
  return `${Number(yearMonth.split('-')[1])}월`;
}

/** 사람 이름(표시 이름 · 앱 닉네임)의 최대 길이. 서버 lib/schemas 의 displayName `.max(20)` 과 같다 */
export const NAME_MAX_LENGTH = 20;

/**
 * 글자 수 한도에 맞춰 자른다. 두 칸짜리 글자(대부분의 이모지)가 한도에 걸치면 통째로 뺀다.
 *
 * 길이는 서버 zod `.max()` 와 같은 기준(`String.length`)으로 센다 — 글자 단위로 세면 이모지가
 * 많은 이름이 한도 안으로 보이지만 서버가 거절한다. 그렇다고 `slice` 로 자르면 이모지가 반쪽이 나
 * 깨진 글자가 칸에 들어간다. 그래서 코드포인트 단위로 하나씩 붙이되 서버 기준 길이가 넘기 전에 멈춘다.
 *
 * ⚠️ 막는 것은 **서러게이트 페어가 반쪽 나는 것**까지다. 여러 코드포인트를 이어 붙인 이모지
 * (피부색 👍🏽 · 가족 👨‍👩‍👧 · 국기)는 한도에 걸치면 조각이 남을 수 있다 — 깨진 글자는 아니고 모양만 달라진다
 */
export function truncateText(text: string, max: number): string {
  let result = '';
  for (const char of text) {
    if (result.length + char.length > max) break;
    result += char;
  }
  return result;
}

/** '오후 2:26' — 마지막으로 확인한 시각처럼 "방금"을 알려줄 때 쓴다 */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}
