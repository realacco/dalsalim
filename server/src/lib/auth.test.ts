import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';

import { AppError } from './http.js';
import { issueToken, rateLimitKey, verifyToken } from './auth.js';

/** 레이트리밋 키를 고르는 데 필요한 부분만 흉내 낸다 */
function request(ip: string, authorization?: string) {
  return { ip, headers: authorization ? { authorization } : {} } as FastifyRequest;
}

describe('토큰 — 로그인했다는 증표', () => {
  it('발급한 토큰에서 사용자 id 를 다시 꺼낼 수 있다', () => {
    expect(verifyToken(issueToken('user-1')).sub).toBe('user-1');
  });

  it('★ 남이 만든 토큰은 통하지 않는다', () => {
    // 서명이 우리 비밀키로 된 것이 아니면 거부한다. 이게 없으면 누구나 남이 될 수 있다
    // 아무 비밀키로도 서명되지 않은 가짜다. 비밀 스캔이 진짜 토큰으로 오해해서 예외를 단다
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.aaaaaaaaaaaaaaaaaaaaaaaaaaa'; // secret-scan:allow
    expect(() => verifyToken(forged)).toThrow(AppError);
  });

  it('망가진 토큰도 401 로 떨어진다 — 500 이 되면 안 된다', () => {
    for (const bad of ['', 'not-a-token', 'a.b.c']) {
      let caught: unknown;
      try {
        verifyToken(bad);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AppError);
      expect((caught as AppError).statusCode).toBe(401);
    }
  });
});

/**
 * ★ 보안 규칙 — 레이트리밋은 사용자 id 로 묶는다. 없을 때만 IP 로 떨어진다.
 *
 * IP 로만 묶으면 한 집에서 같은 공유기를 쓰는 가족끼리 서로의 한도를 갉아먹는다.
 * 아빠가 초대코드를 몇 번 잘못 넣으면 엄마가 로그인을 못 하게 되는 식이다.
 */
describe('rateLimitKey — 누구의 한도로 셀 것인가', () => {
  it('★ 로그인한 사람은 사용자 id 로 묶는다 — 같은 집이어도 서로 안 갉아먹는다', () => {
    const dad = rateLimitKey(request('192.168.0.5', `Bearer ${issueToken('dad')}`));
    const mom = rateLimitKey(request('192.168.0.5', `Bearer ${issueToken('mom')}`));

    expect(dad).toBe('user:dad');
    expect(mom).toBe('user:mom');
    expect(dad).not.toBe(mom); // 같은 공유기(같은 IP)인데도 키가 다르다
  });

  it('같은 사람이 다른 기기에서 들어와도 한 사람으로 센다', () => {
    const phone = rateLimitKey(request('192.168.0.5', `Bearer ${issueToken('dad')}`));
    const laptop = rateLimitKey(request('10.0.0.9', `Bearer ${issueToken('dad')}`));
    expect(phone).toBe(laptop);
  });

  it('로그인 전이면 IP 로 묶는다 — 로그인 자체를 계속 두드리는 것도 막아야 한다', () => {
    expect(rateLimitKey(request('203.0.113.7'))).toBe('203.0.113.7');
  });

  it('★ 토큰이 이상해도 절대 던지지 않는다 — IP 로 떨어질 뿐이다', () => {
    // 여기서 던지면 레이트리밋 단계에서 요청이 500 으로 죽는다.
    // 잘못된 토큰을 거부하는 건 그 다음 단계(requireUser)의 일이다
    for (const header of ['Bearer 망가진토큰', 'Bearer ', 'Basic abc', '']) {
      expect(() => rateLimitKey(request('203.0.113.7', header))).not.toThrow();
      expect(rateLimitKey(request('203.0.113.7', header))).toBe('203.0.113.7');
    }
  });
});
