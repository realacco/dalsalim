import { describe, it, expect } from 'vitest';
import {
  type CalcState,
  MAX_AMOUNT,
  evaluate,
  confirmedExpression,
  formatExpression,
  initialState,
  isCapped,
  isNegative,
  isRounded,
  isSettled,
  pressKey,
  result,
} from './calc';

/** 키를 순서대로 누른 뒤의 상태 */
function press(keys: string[], from: CalcState = { tokens: [], draft: '' }): CalcState {
  return keys.reduce(pressKey, from);
}

describe('★ F-ENT-09 계산 순서', () => {
  it('× ÷ 를 먼저 계산한다 — 종이에 쓴 것과 같아야 한다', () => {
    // 왼→오 순차라면 41,000 이 된다. 수식이 눈에 보이므로 보이는 대로 계산돼야 한다
    expect(evaluate([12000, '+', 8500, '×', 2])).toBe(29000);
    expect(evaluate([2, '×', 3, '+', 4, '×', 5])).toBe(26);
  });

  it('같은 순위는 왼쪽부터', () => {
    expect(evaluate([100, '-', 30, '-', 20])).toBe(50);
    expect(evaluate([100, '÷', 5, '×', 3])).toBe(60);
  });

  it('연산자로 끝나면 그 자리는 없는 셈 친다 — 덜 친 상태에서도 결과가 보여야 한다', () => {
    expect(evaluate([210000, '÷'])).toBe(210000);
    expect(evaluate(['+'])).toBeNull();
    expect(evaluate([])).toBeNull();
  });
});

describe('★ F-ENT-09 정수로 만드는 자리는 마지막 한 번뿐이다 (하드룰 5)', () => {
  it('나눗셈은 반올림한다', () => {
    expect(evaluate([10000, '÷', 3])).toBe(3333);
    // 내림이 아니라 반올림이다 — 1666.67 은 1,667 원이 된다
    expect(evaluate([10000, '÷', 6])).toBe(1667);
    expect(evaluate([10000, '÷', 4])).toBe(2500);
    expect(evaluate([210000, '÷', 2])).toBe(105000);
  });

  it('중간값이 소수여도 마지막에 한 번만 반올림한다 — 매 단계 반올림하면 오차가 쌓인다', () => {
    // 10000/3 = 3333.33… 을 세 번 더하면 정확히 10000 이다. 단계마다 반올림하면 9999 가 된다
    expect(evaluate([10000, '÷', 3, '+', 10000, '÷', 3, '+', 10000, '÷', 3])).toBe(10000);
  });

  it('0 으로 나누면 그 자리를 무시한다 — 사람을 탓하지 않는다', () => {
    expect(evaluate([5000, '÷', 0])).toBe(5000);
    expect(evaluate([5000, '÷', 0, '+', 1000])).toBe(6000);
  });

  it('10억을 넘으면 10억에서 멈춘다', () => {
    expect(evaluate([MAX_AMOUNT, '×', 5])).toBe(MAX_AMOUNT);
  });

  it('반올림이 실제로 일어났을 때만 그렇다고 말한다', () => {
    expect(isRounded({ tokens: [10000, '÷', 3], draft: '' })).toBe(true);
    expect(isRounded({ tokens: [10000, '÷', 4], draft: '' })).toBe(false);
    expect(isRounded({ tokens: [], draft: '' })).toBe(false);
  });
});

describe('F-ENT-09 자판', () => {
  it('칸에 있던 금액을 싣고 연다 — 지우고 시작할 필요가 없다', () => {
    expect(initialState(180000)).toEqual({ tokens: [], draft: '180000' });
    expect(initialState(null)).toEqual({ tokens: [], draft: '' });
    expect(initialState(0)).toEqual({ tokens: [], draft: '' });
  });

  it('숫자와 00 을 이어 친다', () => {
    expect(press(['2', '1', '0', '00']).draft).toBe('21000');
  });

  it('앞자리 0 은 남기지 않는다', () => {
    expect(press(['0', '0', '5']).draft).toBe('5');
  });

  it('10억을 넘기는 숫자는 아예 안 들어간다 — 수식과 결과가 달라지면 안 된다', () => {
    const billion = press('1000000000'.split(''));
    expect(billion.draft).toBe('1000000000');
    expect(press(['0'], billion).draft).toBe('1000000000');
    // 손으로 치는 칸도 같은 자리에서 막는다 (amount-input 이 MAX_AMOUNT 를 여기서 가져간다)
    expect(press(['9', '9', '9', '9', '9', '9', '9', '9', '9']).draft).toBe('999999999');
  });

  it('연산자를 누르면 지금 숫자가 확정되고 칸이 빈다', () => {
    expect(press(['1', '2', '0', '+'])).toEqual({ tokens: [120, '+'], draft: '' });
  });

  it('연산자를 잇달아 누르면 마지막 것이 바뀐다 — 지우러 갈 필요가 없다', () => {
    expect(press(['1', '2', '0', '+', '×'])).toEqual({ tokens: [120, '×'], draft: '' });
  });

  it('아무것도 없을 때 누른 연산자는 무시한다', () => {
    expect(press(['+'])).toEqual({ tokens: [], draft: '' });
  });

  it('← 는 치던 숫자를 한 글자씩, 다 지우면 앞의 토큰을 지운다', () => {
    expect(press(['1', '2', '3', '←']).draft).toBe('12');
    expect(press(['1', '2', '+', '←'])).toEqual({ tokens: [12], draft: '' });
  });

  it('C 는 전부 지운다', () => {
    expect(press(['1', '2', '+', '3', 'C'])).toEqual({ tokens: [], draft: '' });
  });

  it('= 는 지금까지를 하나로 접는다 — 결과는 draft 로 되돌아온다', () => {
    const folded = press(['1', '0', '+', '5', '=']);
    expect(folded.tokens).toEqual([]);
    expect(folded.draft).toBe('15');
    // 접은 뒤에 이어서 계산할 수 있다
    expect(result(press(['1', '0', '+', '5', '=', '×', '2']))).toBe(30);
  });

  it('★ = 뒤의 ← 는 한 글자만 지운다 — 접힌 결과가 통째로 날아가면 C 를 누른 것과 같다', () => {
    expect(press(['1', '0', '+', '5', '=', '←']).draft).toBe('1');
    expect(result(press(['2', '1', '0', '0', '0', '0', '÷', '2', '=', '←']))).toBe(10500);
  });
});

describe('F-ENT-09 수식 한 줄', () => {
  it('친 그대로 보여준다 — 숫자에만 콤마를 붙인다', () => {
    expect(formatExpression(press(['2', '1', '0', '0', '0', '0', '÷', '2']))).toBe('210,000 ÷ 2');
  });

  it('연산자까지만 쳤으면 연산자까지 보여준다', () => {
    expect(formatExpression(press(['2', '1', '0', '0', '0', '0', '÷']))).toBe('210,000 ÷');
  });

  it('아무것도 안 쳤으면 빈 줄이다', () => {
    expect(formatExpression({ tokens: [], draft: '' })).toBe('');
  });
});

describe('★ F-ENT-09 = 를 눌러야 결과가 주인공이 된다', () => {
  it('치는 동안에는 확정 전이다 — 수식이 주인공', () => {
    expect(isSettled(press(['2', '1', '0', '0', '0', '0', '÷', '2']))).toBe(false);
    expect(isSettled(initialState(180000))).toBe(false);
  });

  it('= 를 누르면 확정된다', () => {
    expect(isSettled(press(['2', '1', '0', '0', '0', '0', '÷', '2', '=']))).toBe(true);
  });

  it('다음 키를 누르면 다시 치는 중이다', () => {
    expect(isSettled(press(['1', '0', '+', '5', '=', '+']))).toBe(false);
  });
});

describe('F-ENT-09 칸 아래에 남길 수식', () => {
  it('연산자가 들어간 것만 남긴다', () => {
    expect(confirmedExpression(press(['1', '2', '0']))).toBe('');
    expect(confirmedExpression(press(['1', '2', '0', '÷', '2']))).toBe('120 ÷ 2');
  });

  it('★ = 로 접어도 수식은 남는다 — 자판에 = 가 있으면 사람은 누르고 나서 확정한다', () => {
    expect(confirmedExpression(press(['1', '0', '+', '5', '=']))).toBe('10 + 5');
    expect(confirmedExpression(press(['2', '1', '0', '0', '0', '0', '÷', '2', '=']))).toBe(
      '210,000 ÷ 2',
    );
  });

  it('= 뒤에 다른 키를 누르면 그 수식은 버린다 — 더는 지금 금액을 설명하지 않는다', () => {
    expect(confirmedExpression(press(['1', '0', '+', '5', '=', '7']))).toBe('');
    expect(confirmedExpression(press(['1', '0', '+', '5', '=', '←']))).toBe('');
  });

  it('열자마자 확정해도 남기지 않는다', () => {
    expect(confirmedExpression(initialState(180000))).toBe('');
  });

  it('덜 친 연산자는 떼고 남긴다 — 120 ÷ 로 확정하면 금액은 120 이다', () => {
    const half = press(['1', '2', '0', '÷']);
    expect(formatExpression(half)).toBe('120 ÷');
    expect(confirmedExpression(half)).toBe('');
  });
});

describe('★ F-ENT-09 상한에 걸리면 조용히 접지 않는다', () => {
  it('곱셈 결과가 10억을 넘으면 접힌 사실을 알 수 있어야 한다', () => {
    const over = { tokens: [500_000_000, '×' as const, 3], draft: '' };
    expect(isCapped(over)).toBe(true);
    expect(evaluate([500_000_000, '×', 3])).toBe(MAX_AMOUNT);
    expect(isCapped(press(['1', '0', '0']))).toBe(false);
  });
});

describe('★ F-ENT-09 = 를 눌러도 안내가 사라지지 않는다', () => {
  it('반올림한 사실은 = 뒤에도 말한다 — 1원 아래를 버린 금액인데 화면에 흔적이 없으면 안 된다', () => {
    const divided = press(['1', '0', '0', '0', '0', '÷', '3']);
    expect(isRounded(divided)).toBe(true);
    const folded = pressKey(divided, '=');
    expect(result(folded)).toBe(3333);
    expect(isRounded(folded)).toBe(true);
    expect(confirmedExpression(folded)).toBe('10,000 ÷ 3');
  });

  it('상한에 걸린 사실도 = 뒤에 남는다', () => {
    const over = press(['5', '0', '0', '0', '0', '0', '0', '0', '0', '×', '3']);
    expect(isCapped(over)).toBe(true);
    expect(isCapped(pressKey(over, '='))).toBe(true);
  });

  it('접은 값은 이미 반올림된 정수다 — 보이는 3,333 과 다음 계산이 쓰는 값이 같다', () => {
    expect(result(press(['1', '0', '0', '0', '0', '÷', '3', '=', '×', '3']))).toBe(9999);
  });
});

describe('★ F-ENT-09 음수는 칸에 넣을 수 없다', () => {
  it('결과가 음수면 확정을 막는다', () => {
    expect(isNegative(press(['1', '0', '0', '-', '5', '0', '0']))).toBe(true);
    expect(isNegative(press(['5', '0', '0', '-', '1', '0', '0']))).toBe(false);
    // 아무것도 안 친 상태는 음수가 아니다 — 막을 이유가 없다
    expect(isNegative({ tokens: [], draft: '' })).toBe(false);
  });

  it('★ = 로 접힌 음수를 ← 로 지워도 NaN 이 새어 나가지 않는다', () => {
    // '=' 가 결과를 draft 로 되돌리므로 음수일 때 draft 에 '-' 가 들어간다.
    // 거기서 ← 를 눌러 '-' 하나만 남으면 Number('-') 는 NaN 이다.
    const minus = press(['1', '-', '5', '=']);
    expect(minus.draft).toBe('-4');

    const rubbed = press(['←', '←'], minus);
    expect(rubbed.draft).toBe('');
    expect(result(rubbed)).toBeNull();

    // 지우다 '-' 하나만 남는 순간이 문제였다 — 값이 없는 것으로 봐야 한다
    const dashOnly = { tokens: [], draft: '-' };
    expect(result(dashOnly)).toBeNull();
    expect(isNegative(dashOnly)).toBe(false);
    expect(formatExpression(dashOnly)).toBe('');
  });
});

describe('★ F-ENT-09 관리비를 형과 반씩 낸다', () => {
  it('열 때 실렸던 금액을 C 로 비우고 210000 ÷ 2 = 105,000원', () => {
    const state = press(['C', '2', '1', '0', '0', '0', '0', '÷', '2'], initialState(180000));
    expect(result(state)).toBe(105000);
    expect(formatExpression(state)).toBe('210,000 ÷ 2');
    expect(isRounded(state)).toBe(false);
  });

  it('실려 온 금액에 이어서 치면 그 뒤에 붙는다 — 그래서 먼저 지우는 것이 정상 경로다', () => {
    expect(press(['2'], initialState(180000)).draft).toBe('1800002');
  });
});
