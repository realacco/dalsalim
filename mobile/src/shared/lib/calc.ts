// 기능: F-ENT-09
/**
 * 금액 계산기의 규칙. **순수 함수만 둔다** — react 를 임포트하지 않는다.
 *
 * 화면(`shared/ui/calculator-sheet`)은 키를 이 함수들에 넘기고 결과를 그리기만 한다.
 * 그래야 우선순위·반올림 같은 "틀리면 금액이 달라지는 것"이 1층에서 검증된다.
 */

import { formatAmount } from './format';

export type Operator = '+' | '-' | '×' | '÷';
export type Token = number | Operator;

/** 확정된 토큰들과, 지금 치고 있는 숫자. 숫자를 문자열로 들고 있어야 앞자리 0 을 다룰 수 있다 */
export type CalcState = {
  tokens: Token[];
  draft: string;
  /**
   * 열 때 실려 온 금액이 아직 그대로인가.
   *
   * 옆의 금액 칸은 포커스하는 순간 전체를 선택해 **첫 글자가 통째로 대체**된다
   * ("다른 금액을 적으려면 먼저 지워야 하는 칸이 되면 매달 성가시다"가 그 근거다).
   * 계산기만 뒤에 이어 붙으면 같은 화면에서 같은 값을 두 규칙으로 다루게 되고,
   * 180,000 이 실린 채 `2` 를 누르면 1,800,002 가 된다.
   *
   * 그래서 **첫 키가 숫자면 실려 온 값을 대체한다.** 연산자를 먼저 누르면(180,000 + …)
   * 실려 온 값을 쓰겠다는 뜻이므로 그대로 둔다. 어떤 키든 한 번 누르면 이 표시는 사라진다.
   */
  fresh?: boolean;
  /**
   * `=` 로 접기 직전의 토큰들.
   *
   * 접고 나면 남는 것은 결과 하나뿐이라 **무엇을 눌러 그 금액이 됐는지도, 반올림이
   * 있었는지도 상태에서 지워진다.** 자판에 `=` 가 있으면 사람은 누르고 나서 확정하므로,
   * 가장 흔한 손버릇에서 수식 한 줄과 "반올림했어요" 가 조용히 사라지는 셈이었다.
   * 그래서 접기 전 원본을 한 벌 들고 간다. 다음 키를 누르면 버린다.
   */
  folded?: Token[];
};

export const MAX_AMOUNT = 1_000_000_000;
const MAX_DIGITS = 10;

export const OPERATORS: Operator[] = ['+', '-', '×', '÷'];

export function isOperator(token: Token): token is Operator {
  return typeof token === 'string';
}

/** 칸에 있던 금액을 첫 숫자로 싣고 연다. 0 이나 빈 칸이면 빈 채로 */
export function initialState(value: number | null): CalcState {
  const draft = value === null || value === 0 ? '' : String(value);
  return draft === '' ? { tokens: [], draft } : { tokens: [], draft, fresh: true };
}

export function isEmpty(state: CalcState): boolean {
  return state.tokens.length === 0 && state.draft === '';
}

/** 확정된 것 + 지금 치는 숫자. 계산은 언제나 이걸로 한다 — 상태를 두 벌 두지 않기 위해서다 */
function allTokens(state: CalcState): Token[] {
  const typed = Number(state.draft);
  // draft 가 숫자가 아니면 아직 안 친 것으로 본다.
  //
  // ★ '=' 가 결과를 draft 로 되돌리는데 그 값이 음수면 '-' 가 draft 에 들어간다.
  //   거기서 ← 로 자릿수를 지워 나가면 '-' 하나만 남고, Number('-') 는 NaN 이다.
  //   그대로 흘리면 evaluate 가 null 이 아니라 NaN 을 내고 → isNegative 가 false 가 되어
  //   경고가 사라진 채 [이 금액 쓰기] 가 열린다. 칸에 NaN 이 박히고 저장은 400 으로 끝난다.
  if (state.draft === '' || !Number.isFinite(typed)) return state.tokens;
  return [...state.tokens, typed];
}

/**
 * 표준 우선순위(× ÷ 가 먼저)로 계산한다. 종이에 쓴 것과 같아야 하기 때문이다 —
 * 수식이 화면에 그대로 보이므로, 보이는 것과 다르게 계산하면 틀렸을 때 사람이 못 찾는다.
 *
 * 여기서는 **반올림하지 않는다.** 나눗셈이 섞이면 중간값이 소수일 수 있고,
 * 매 단계 반올림하면 오차가 쌓인다. 정수로 만드는 것은 마지막에 딱 한 번이다.
 */
export function evaluateExact(tokens: Token[]): number | null {
  const items = [...tokens];
  // 연산자로 끝나면 아직 덜 친 것이다. 그 자리는 없는 셈 친다
  if (items.length > 0 && isOperator(items[items.length - 1])) items.pop();
  if (items.length === 0) return null;

  const folded: Token[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item === '×' || item === '÷') {
      const left = folded.pop() as number;
      const right = items[i + 1] as number;
      i += 1;
      // 0 으로 나누는 것은 계산하지 않고 그 자리를 무시한다. 사람을 탓하지 않는다
      folded.push(item === '×' ? left * right : right === 0 ? left : left / right);
    } else {
      folded.push(item);
    }
  }

  let acc = folded[0] as number;
  for (let i = 1; i < folded.length; i += 2) {
    const right = folded[i + 1] as number;
    acc = folded[i] === '+' ? acc + right : acc - right;
  }
  return acc;
}

/** 화면에 보여주고 칸에 넣을 값 — 원 단위 정수 (하드룰 5). 소수는 여기서 한 번만 반올림한다 */
export function evaluate(tokens: Token[]): number | null {
  const exact = evaluateExact(tokens);
  if (exact === null || !Number.isFinite(exact)) return null;
  return Math.min(Math.round(exact), MAX_AMOUNT);
}

export function result(state: CalcState): number | null {
  return evaluate(allTokens(state));
}

/**
 * `=` 로 접었으면 접기 전 상태로 되돌려 본다.
 * 수식·반올림·상한은 전부 "무엇을 눌렀나"에 대한 대답이라, 접힌 결과가 아니라 원본을 봐야 한다.
 */
function sourceState(state: CalcState): CalcState {
  return state.folded ? { tokens: state.folded, draft: '' } : state;
}

/** 상한에 걸려 접혔나 — 조용히 접지 않고 한 줄 알려주기 위해 묻는다 */
export function isCapped(state: CalcState): boolean {
  const exact = evaluateExact(allTokens(sourceState(state)));
  return exact !== null && Math.round(exact) > MAX_AMOUNT;
}

/**
 * `=` 로 값을 확정했나.
 *
 * 계산기는 **치는 동안에는 수식이 주인공**이고, `=` 를 눌러야 결과가 주인공이 된다.
 * 그게 사람이 아는 계산기라, 화면도 그 순서를 따라야 지금 무엇을 치고 있는지가 보인다.
 */
export function isSettled(state: CalcState): boolean {
  return state.folded !== undefined;
}

/** 반올림이 실제로 일어났나 — 일어났을 때만 "반올림했어요" 를 말한다 */
export function isRounded(state: CalcState): boolean {
  const exact = evaluateExact(allTokens(sourceState(state)));
  return exact !== null && !Number.isInteger(exact);
}

/**
 * 결과가 음수인가 — 칸에 넣을 수 없다.
 * 상한·반올림과 같은 자리에 둔다. 셋이 흩어지면 "확정할 수 있는 조건"을 한 곳에서 못 읽는다.
 */
export function isNegative(state: CalcState): boolean {
  const value = result(state);
  return value !== null && value < 0;
}

/**
 * 키 하나를 눌렀을 때의 다음 상태.
 *
 * 숫자 · `00` · 연산자 · `C`(전부 지우기) · `←`(한 글자) · `=`(지금까지를 하나로 접기)
 */
export function pressKey(input: CalcState, key: string): CalcState {
  // 어떤 키를 누르든 "실려 온 값" 상태는 여기서 끝난다
  const { fresh, ...state } = input;

  if (key === 'C') return { tokens: [], draft: '' };

  if (key === '←') {
    // 접힌 결과가 draft 에 있으므로 여기서 한 글자만 지워진다.
    // tokens 에 넣어뒀을 때는 ← 한 번에 105,000 이 통째로 날아갔다 (C 를 누른 것과 같았다)
    if (state.draft !== '') return { tokens: state.tokens, draft: state.draft.slice(0, -1) };
    if (state.tokens.length === 0) return { tokens: [], draft: '' };
    return { tokens: state.tokens.slice(0, -1), draft: '' };
  }

  if (key === '=') {
    const value = result(state);
    if (value === null) return state;
    // 결과를 tokens 가 아니라 draft 로 되돌린다 — 이어서 치거나 한 글자 지우는 길이 살아 있어야 한다.
    // 접은 값은 이미 반올림된 정수다. 보이는 3,333 과 다음 계산이 쓰는 값이 같아야 하므로
    // 정확값으로 되돌리지 않는다 (수식 줄과 결과가 갈라지면 안 된다는 아래 MAX_DIGITS 와 같은 축)
    return { tokens: [], draft: String(value), folded: state.folded ?? allTokens(state) };
  }

  if (OPERATORS.includes(key as Operator)) {
    const operator = key as Operator;
    if (state.draft === '') {
      if (state.tokens.length === 0) return state;
      // 연산자를 잇달아 누르면 마지막 것을 바꾼다. 잘못 눌렀을 때 지우러 갈 필요가 없다
      const last = state.tokens[state.tokens.length - 1];
      if (isOperator(last)) {
        return { tokens: [...state.tokens.slice(0, -1), operator], draft: '' };
      }
      return { tokens: [...state.tokens, operator], draft: '' };
    }
    return { tokens: [...state.tokens, Number(state.draft), operator], draft: '' };
  }

  // 여기부터는 숫자 — '0'~'9' 와 '00'
  const digits = key.replace(/[^0-9]/g, '');
  if (digits === '') return state;

  // 실려 온 값이 그대로면 이어 붙이지 않고 갈아탄다 (위 fresh 주석)
  const next = (fresh ? digits : state.draft + digits).replace(/^0+(?=\d)/, '');
  // 상한을 넘기면 아예 안 받는다. 수식 줄에는 100억이 보이는데 결과만 10억으로
  // 접히면, 보이는 것과 계산된 것이 달라진다 — 손으로 치는 칸과도 규칙이 갈라진다
  if (next.length > MAX_DIGITS || Number(next) > MAX_AMOUNT) return state;
  return { tokens: state.tokens, draft: next };
}

/**
 * 칸 아래에 남길 수식. 남길 것이 없으면 빈 문자열이다.
 *
 * 둘을 걸러낸다.
 *  - 덜 친 연산자로 끝나면 떼고 남긴다 — `120 ÷` 로 확정하면 금액은 120 이라 수식과 안 맞는다
 *  - 그러고 나서 연산자가 하나도 없으면 빈 줄이다 — `105,000` 아래에 `105,000` 을 다시 적는 것은
 *    "무엇을 해서 이 금액이 됐는지"가 아니다. `=` 로 접었거나 열자마자 확정한 경우다
 *
 * 지금 치는 중의 표시(`formatExpression`)는 덜 친 연산자를 그대로 보여준다. 그건 맞다.
 */
export function confirmedExpression(state: CalcState): string {
  const from = sourceState(state);
  const tokens = [...from.tokens];
  if (from.draft === '' && tokens.length > 0 && isOperator(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.some(isOperator)) return '';
  return formatExpression({ tokens, draft: from.draft });
}

/** `210,000 ÷ 2` — 지금까지 친 수식을 그대로 보여주는 한 줄. `=` 뒤에는 접기 전 수식이다 */
export function formatExpression(state: CalcState): string {
  const parts = allTokens(sourceState(state)).map((token) =>
    isOperator(token) ? token : formatAmount(token),
  );
  return parts.join(' ');
}
