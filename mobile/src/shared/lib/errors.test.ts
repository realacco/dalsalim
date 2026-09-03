import { describe, expect, it, vi } from 'vitest';

// errors 는 ApiError 를 알아보려고 client 를 임포트하고, client 는 앱 주소를 고르려고
// expo-constants 와 react-native 를 읽는다. 여기서는 그 둘이 필요 없다
vi.mock('expo-constants', () => ({ default: { expoConfig: null, expoGoConfig: null } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { ApiError } from '@/shared/api/client';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from './errors';

/**
 * 서버가 준 문장과 폴백 문장 중 무엇을 보여줄지 가르는 **유일한 지점**이다.
 * 화면 10곳 넘게가 이 함수를 지난다 — 여기가 흔들리면 실패 표현 규칙이 통째로 흔들린다.
 */
describe('errorMessage — 서버 문장과 폴백 사이의 갈림길', () => {
  it('★ 서버가 준 문장이 있으면 그것을 그대로 보여준다', () => {
    // 서버 message 는 화면에 그대로 뜨는 한국어다 (CLAUDE.md 코드 규칙).
    // 앱이 고쳐 쓰면 서버가 아는 상황을 잃는다
    const caught = new ApiError(403, 'OWNER_ONLY', '가족장만 할 수 있어요.');
    expect(errorMessage(caught, MESSAGES.actionFailedBody)).toBe('가족장만 할 수 있어요.');
  });

  it('★ 서버가 준 것이 아니면 폴백 문장으로 바꾼다', () => {
    // 코드 버그로 생긴 오류를 사용자에게 보여줄 이유가 없다.
    // 영어 스택이나 "undefined is not a function" 이 화면에 뜨면 안 된다
    expect(errorMessage(new TypeError('x.y is not a function'), MESSAGES.saveFailed)).toBe(
      MESSAGES.saveFailed,
    );
  });

  it('오류가 아닌 것을 던져도 폴백으로 받는다', () => {
    // throw 는 무엇이든 던질 수 있다. 문자열도, null 도, 객체도
    for (const thrown of ['문자열', null, undefined, 42, { message: '가짜' }]) {
      expect(errorMessage(thrown, MESSAGES.loadFailed)).toBe(MESSAGES.loadFailed);
    }
  });

  it('상황마다 다른 폴백을 고를 수 있다', () => {
    const caught = new Error('무언가');
    expect(errorMessage(caught, MESSAGES.loadFailed)).toBe(MESSAGES.loadFailed);
    expect(errorMessage(caught, MESSAGES.saveFailed)).toBe(MESSAGES.saveFailed);
    expect(errorMessage(caught, MESSAGES.openFailed)).toBe(MESSAGES.openFailed);
  });

  it('서버에 닿지 못한 것도 서버가 준 문장으로 친다 — 주소가 담겨 있다', () => {
    // client 가 만든 NETWORK 오류는 ApiError 라서 그 문장이 그대로 뜬다.
    // 어느 주소로 못 갔는지가 개발 중에 유일한 단서다
    const caught = new ApiError(0, 'NETWORK', `${MESSAGES.network}\n(http://localhost:4000)`);
    expect(errorMessage(caught, MESSAGES.loadFailed)).toContain('localhost:4000');
  });

  it('서버 문장이 빈 문자열이면 폴백으로 넘어간다', () => {
    // 빈 문장을 그대로 보여주면 화면에 아무것도 안 뜬다 — 빈 화면과 같은 실수다
    const caught = new ApiError(500, 'INTERNAL', '');
    expect(errorMessage(caught, MESSAGES.loadFailed)).toBe(MESSAGES.loadFailed);
  });
});
