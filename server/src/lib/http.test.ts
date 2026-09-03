import { describe, it, expect } from 'vitest';
import {
  AppError,
  badRequest,
  conflict,
  forbidden,
  notFound,
  tooManyRequests,
  unauthorized,
} from './http.js';

/**
 * message 는 화면에 그대로 뜬다 (CLAUDE.md 코드 규칙).
 * code 는 앱이 분기하는 용도라 문구가 바뀌어도 흔들리면 안 된다.
 */
describe('AppError — 클라이언트에 그대로 노출되는 에러', () => {
  it('상태코드 · code · message 를 그대로 들고 있다', () => {
    const error = badRequest('AMOUNT_REQUIRED', '금액을 적어주세요.');
    // 전역 에러 핸들러가 AppError 인지로 "노출해도 되는 에러"를 가른다
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('AMOUNT_REQUIRED');
    expect(error.message).toBe('금액을 적어주세요.');
  });

  it('상태코드별 헬퍼가 약속된 code 를 만든다', () => {
    expect([unauthorized().statusCode, unauthorized().code]).toEqual([401, 'UNAUTHORIZED']);
    expect([forbidden().statusCode, forbidden().code]).toEqual([403, 'FORBIDDEN']);
    expect([notFound().statusCode, notFound().code]).toEqual([404, 'NOT_FOUND']);
    expect([tooManyRequests().statusCode, tooManyRequests().code]).toEqual([429, 'RATE_LIMITED']);
    expect(conflict('CODE_TAKEN', '이미 쓰는 코드예요.').statusCode).toBe(409);
  });

  it('forbidden 은 code 를 바꿔 달 수 있다 — 앱이 상황별로 분기한다', () => {
    const error = forbidden('가족장만 할 수 있어요.', 'OWNER_ONLY');
    expect(error.code).toBe('OWNER_ONLY');
    expect(error.statusCode).toBe(403);
  });

  it('★ 기본 메시지는 전부 한국어다 — 그대로 화면에 뜬다', () => {
    const defaults = [unauthorized(), forbidden(), notFound(), tooManyRequests()];
    for (const error of defaults) {
      expect(error.message).toMatch(/[가-힣]/);
      expect(error.message).not.toMatch(/[A-Za-z]{4,}/);
    }
  });
});
