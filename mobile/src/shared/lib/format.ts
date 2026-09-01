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

/** '오후 2:26' — 마지막으로 확인한 시각처럼 "방금"을 알려줄 때 쓴다 */
export function formatClock(date: Date): string {
  return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}
