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
   * draft 가 "이어 붙일 것"이 아니라 "갈아탈 것"인가.
   *
   * 옆의 금액 칸은 포커스하는 순간 전체를 선택해 **첫 글자가 통째로 대체**된다
   * ("다른 금액을 적으려면 먼저 지워야 하는 칸이 되면 매달 성가시다"가 그 근거다).
   * 계산기만 뒤에 이어 붙으면 같은 화면에서 같은 값을 두 규칙으로 다루게 되고,
   * 180,000 이 실린 채 `2` 를 누르면 1,800,002 가 된다.
   *
   * 그래서 **첫 키가 숫자면 실려 온 값을 대체한다.** 연산자를 먼저 누르면(180,000 + …)
   * 실려 온 값을 쓰겠다는 뜻이므로 그대로 둔다. 어떤 키든 한 번 누르면 이 표시는 사라진다.
   *
   * `=` 로 접힌 결과도 같은 자리에 있다 — 사람이 아는 계산기는 `=` 뒤 첫 숫자에서 새로 시작한다.
   * 안 그러면 `100 + 50 =` 뒤에 `7` 을 눌렀을 때 1,507 이 된다.
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

const OPERATORS: Operator[] = ['+', '-', '×', '÷'];

function isOperator(token: Token): token is Operator {
  return typeof token === 'string';
}

/** 칸에 있던 금액을 첫 숫자로 싣고 연다. 0 이나 빈 칸이면 빈 채로 */
export function initialState(value: number | null): CalcState {
  const draft = value === null || value === 0 ? '' : String(value);
  return draft === '' ? { tokens: [], draft } : { tokens: [], draft, fresh: true };
}

/**
 * 지금 치는 숫자의 값. 숫자가 아니면 아직 안 친 것으로 본다 — `null`.
 *
 * ★ '=' 가 결과를 draft 로 되돌리는데 그 값이 음수면 '-' 가 draft 에 들어간다.
 *   거기서 ← 로 자릿수를 지워 나가면 '-' 하나만 남고, Number('-') 는 NaN 이다.
 *   그대로 흘리면 evaluate 가 null 이 아니라 NaN 을 내고 → isNegative 가 false 가 되어
 *   경고가 사라진 채 [이 금액 쓰기] 가 열린다. 칸에 NaN 이 박히고 저장은 400 으로 끝난다.
 *   draft 를 숫자로 읽는 곳은 전부 여기를 거친다 — 한 곳만 막으면 다른 곳으로 샌다
 *   (처음엔 계산 쪽만 막았더니 연산자를 누를 때 NaN 이 tokens 로 들어가 수식 줄에 보였다).
 */
function draftValue(state: CalcState): number | null {
  if (state.draft === '') return null;
  const typed = Number(state.draft);
  return Number.isFinite(typed) ? typed : null;
}

/** 확정된 것 + 지금 치는 숫자. 계산은 언제나 이걸로 한다 — 상태를 두 벌 두지 않기 위해서다 */
function allTokens(state: CalcState): Token[] {
  const typed = draftValue(state);
  return typed === null ? state.tokens : [...state.tokens, typed];
}

/**
 * 실제로 계산에 들어가는 토큰. 둘을 걷어낸다.
 *  - 덜 친 연산자로 끝나면 그 자리는 없는 셈 친다 — 치는 중에도 결과가 보여야 한다
 *  - `÷ 0` 은 계산하지 않고 그 자리를 무시한다 — 사람을 탓하지 않는다
 *
 * 걷어내는 자리를 여기 한 곳에 둔다. 계산과 "칸 아래에 남길 수식"이 같은 토큰을 봐야
 * 칸의 금액과 수식이 갈라지지 않는다 (`100 ÷ 0` 으로 100 을 확정했는데 수식만 `100 ÷ 0` 이면
 * 몇 달 뒤 읽는 사람은 무엇을 믿어야 하는지 모른다).
 */
function effectiveTokens(tokens: Token[]): Token[] {
  const items: Token[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const item = tokens[i];
    if (item === '÷' && tokens[i + 1] === 0) {
      i += 1;
      continue;
    }
    items.push(item);
  }
  if (items.length > 0 && isOperator(items[items.length - 1])) items.pop();
  return items;
}

/**
 * 표준 우선순위(× ÷ 가 먼저)로 계산한다. 종이에 쓴 것과 같아야 하기 때문이다 —
 * 수식이 화면에 그대로 보이므로, 보이는 것과 다르게 계산하면 틀렸을 때 사람이 못 찾는다.
 *
 * 여기서는 **반올림하지 않는다.** 나눗셈이 섞이면 중간값이 소수일 수 있고,
 * 매 단계 반올림하면 오차가 쌓인다. 정수로 만드는 것은 마지막에 딱 한 번이다.
 */
function evaluateExact(tokens: Token[]): number | null {
  const items = effectiveTokens(tokens);
  if (items.length === 0) return null;

  const folded: Token[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (item === '×' || item === '÷') {
      const left = folded.pop() as number;
      const right = items[i + 1] as number;
      i += 1;
      folded.push(item === '×' ? left * right : left / right);
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

/** `÷ 0` 이 들어 있나 — 그 자리를 건너뛰었다고 한 줄 알려주기 위해 묻는다 */
export function dividesByZero(state: CalcState): boolean {
  const tokens = allTokens(sourceState(state));
  return tokens.some((token, i) => token === '÷' && tokens[i + 1] === 0);
}

/**
 * 연산이 하나라도 들어갔나 — 숫자 하나뿐이면 결과 줄을 안 그린다.
 * `105,000` 아래에 `= 105,000` 을 다시 적는 것은 아무것도 설명하지 않는다.
 */
export function hasOperation(state: CalcState): boolean {
  const tokens = allTokens(sourceState(state));
  // 덜 친 연산자(`120 ÷`)는 아직 숫자 하나다. `÷ 0` 은 계산에서 빠지지만 친 것은 친 것이라 남긴다 —
  // 결과 줄과 "건너뛰었어요" 안내가 같이 보여야 무슨 일이 났는지 읽힌다
  if (tokens.length > 0 && isOperator(tokens[tokens.length - 1])) tokens.pop();
  return tokens.some(isOperator);
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

/**
 * 반올림이 실제로 일어났나 — 일어났을 때만 "반올림했어요" 를 말한다.
 *
 * Number.isInteger 로 재면 안 된다. 나눗셈이 섞이면 정확히 떨어지는 수식도 마지막 자리에
 * 부동소수 잔차가 남는다 (29 ÷ 7 × 7 = 29.000000000000004). 그러면 반올림한 적 없는데
 * "1원 아래는 반올림했어요" 가 뜬다. 원 단위에서 의미 있는 차이만 센다.
 */
export function isRounded(state: CalcState): boolean {
  const exact = evaluateExact(allTokens(sourceState(state)));
  return exact !== null && Math.abs(exact - Math.round(exact)) > ROUNDING_EPSILON;
}

/** 이보다 작은 차이는 부동소수 잔차로 본다. 1원의 10억분의 1 — 상한 10억까지 어떤 수식도 이 아래로 못 내려온다 */
const ROUNDING_EPSILON = 1e-9;

/**
 * 결과가 음수인가 — 칸에 넣을 수 없다.
 * 상한·반올림과 같은 자리에 둔다. 셋이 흩어지면 "확정할 수 있는 조건"을 한 곳에서 못 읽는다.
 */
export function isNegative(state: CalcState): boolean {
  const value = result(state);
  return value !== null && value < 0;
}

export type Notice = 'negative' | 'capped' | 'dividesByZero' | 'rounded';

/**
 * 시트에 띄울 안내 — **한 번에 하나만.**
 *
 * 넷은 서로 배타적이지 않다 (`1 ÷ 3 - 100` 은 반올림이면서 음수다). 둘을 다 그리면 시트가
 * 한 줄만큼 커져 자판이 손 밑에서 움직인다 — 안내 자리를 미리 잡아둔 이유가 무너진다.
 * 그래서 가장 급한 것 하나만 말한다:
 *  1. 음수 — 확정 자체가 막힌다. 고치기 전엔 나머지는 의미가 없다
 *  2. 상한 — 결과가 친 것과 다르다. 접힌 값은 정확히 10억이라 반올림 이야기는 무의미하다
 *  3. ÷ 0 — 결과가 친 것과 다르다
 *  4. 반올림 — 결과는 맞되 1원 아래를 버렸다
 */
export function notice(state: CalcState): Notice | null {
  if (isNegative(state)) return 'negative';
  if (isCapped(state)) return 'capped';
  if (dividesByZero(state)) return 'dividesByZero';
  if (isRounded(state)) return 'rounded';
  return null;
}

/**
 * 키 하나를 눌렀을 때의 다음 상태.
 *
 * 숫자 · `00` · 연산자 · `C`(전부 지우기) · `←`(한 글자) · `=`(지금까지를 하나로 접기)
 */
export function pressKey(input: CalcState, key: string): CalcState {
  // 어떤 키를 누르든 "갈아탈 값" 상태는 여기서 끝난다
  const { fresh, ...state } = input;

  if (key === 'C') return { tokens: [], draft: '' };

  if (key === '←') {
    // 치던 숫자가 있으면 그 한 글자만 지운다
    if (state.draft !== '') return { tokens: state.tokens, draft: state.draft.slice(0, -1) };

    const tokens = [...state.tokens];
    const last = tokens.pop();
    if (last === undefined) return { tokens: [], draft: '' };
    // 연산자를 지우면 그 앞의 숫자가 다시 "치던 숫자"가 된다. tokens 에 남겨두면 다음 ← 에
    // 10 이 1 로 줄지 않고 통째로 날아간다 — `=` 가 결과를 tokens 아닌 draft 로 되돌리는 것과 같은 이유다
    if (isOperator(last)) {
      const number = tokens.pop();
      return { tokens, draft: number === undefined ? '' : String(number) };
    }
    return { tokens, draft: String(last).slice(0, -1) };
  }

  if (key === '=') {
    const value = result(state);
    if (value === null) return state;
    // 결과를 tokens 가 아니라 draft 로 되돌린다 — 이어서 치거나 한 글자 지우는 길이 살아 있어야 한다.
    // 접은 값은 이미 반올림된 정수다. 보이는 3,333 과 다음 계산이 쓰는 값이 같아야 하므로
    // 정확값으로 되돌리지 않는다 (수식 줄과 결과가 갈라지면 안 된다는 아래 MAX_DIGITS 와 같은 축)
    return {
      tokens: [],
      draft: String(value),
      fresh: true,
      folded: state.folded ?? allTokens(state),
    };
  }

  if (OPERATORS.includes(key as Operator)) {
    const operator = key as Operator;
    const typed = draftValue(state);
    if (typed === null) {
      // 값이 없는 draft('-' 하나만 남은 것)는 여기서 같이 버린다. 남겨두면 다음 숫자가 그 뒤에 붙는다
      if (state.tokens.length === 0) return { tokens: [], draft: '' };
      // 연산자를 잇달아 누르면 마지막 것을 바꾼다. 잘못 눌렀을 때 지우러 갈 필요가 없다
      const last = state.tokens[state.tokens.length - 1];
      if (isOperator(last)) {
        return { tokens: [...state.tokens.slice(0, -1), operator], draft: '' };
      }
      return { tokens: [...state.tokens, operator], draft: '' };
    }
    return { tokens: [...state.tokens, typed, operator], draft: '' };
  }

  // 여기부터는 숫자 — '0'~'9' 와 '00'
  const digits = key.replace(/[^0-9]/g, '');
  if (digits === '') return state;

  // 갈아탈 값이면 이어 붙이지 않는다 (위 fresh 주석)
  const next = (fresh ? digits : state.draft + digits).replace(/^0+(?=\d)/, '');
  // 상한을 넘기면 아예 안 받는다. 수식 줄에는 100억이 보이는데 결과만 10억으로
  // 접히면, 보이는 것과 계산된 것이 달라진다 — 손으로 치는 칸과도 규칙이 갈라진다
  if (next.length > MAX_DIGITS || Number(next) > MAX_AMOUNT) return state;
  return { tokens: state.tokens, draft: next };
}

/**
 * 칸 아래에 남길 수식. 남길 것이 없으면 빈 문자열이다.
 *
 * ★ 남기는 것은 "친 것"이 아니라 **"계산된 것"** 이다 — 칸의 금액과 다른 수식이 남으면
 *   몇 달 뒤 그 줄을 읽는 사람이 어느 쪽을 믿어야 하는지 모른다.
 *  - 덜 친 연산자와 `÷ 0` 은 계산에서 빠졌으니 수식에서도 뺀다 (`effectiveTokens` 한 곳)
 *  - 상한에 걸려 접혔으면 아무 수식도 그 금액을 설명하지 못한다 — 빈 줄이다
 *  - 그러고 나서 연산자가 하나도 없으면 빈 줄이다 — `105,000` 아래에 `105,000` 을 다시 적는 것은
 *    "무엇을 해서 이 금액이 됐는지"가 아니다. `=` 로 접었거나 열자마자 확정한 경우다
 *
 * 지금 치는 중의 표시(`formatExpression`)는 친 그대로 보여준다. 그건 맞다 — 시트에는 안내 줄이 같이 있다.
 */
export function confirmedExpression(state: CalcState): string {
  if (isCapped(state)) return '';
  const tokens = effectiveTokens(allTokens(sourceState(state)));
  if (!tokens.some(isOperator)) return '';
  return joinTokens(tokens);
}

/** `210,000 ÷ 2` — 지금까지 친 수식을 그대로 보여주는 한 줄. `=` 뒤에는 접기 전 수식이다 */
export function formatExpression(state: CalcState): string {
  return joinTokens(allTokens(sourceState(state)));
}

function joinTokens(tokens: Token[]): string {
  return tokens.map((token) => (isOperator(token) ? token : formatAmount(token))).join(' ');
}
