import { describe, it, expect } from 'vitest';
import { AppError, fail } from './http.js';
import { messageFor } from './messages.js';

/**
 * message 는 화면에 그대로 뜬다 (CLAUDE.md 코드 규칙).
 * code 는 앱이 분기하는 용도라 문구가 바뀌어도 흔들리면 안 된다.
 */
describe('fail() — 라우트가 실패를 만드는 유일한 방법', () => {
  it('사전의 상태코드 · code · message 를 그대로 든 AppError 를 만든다', () => {
    const error = fail('OWNER_ONLY');
    // 전역 에러 핸들러가 AppError 인지로 "노출해도 되는 에러"를 가른다
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('OWNER_ONLY');
    expect(error.message).toBe(messageFor('OWNER_ONLY'));
  });

  it('상태코드는 코드마다 사전이 정한 대로다', () => {
    expect(fail('UNAUTHORIZED').statusCode).toBe(401);
    expect(fail('ENTRY_NOT_FOUND').statusCode).toBe(404);
    expect(fail('ALREADY_MEMBER').statusCode).toBe(409);
    expect(fail('RATE_LIMITED').statusCode).toBe(429);
  });

  it('★ 사유 강제는 어느 항목이 비었는지를 같이 말한다 (제출), 줄 저장은 항목 없이', () => {
    expect(fail('REASON_REQUIRED', '월세, 통신비').message).toBe(
      '사유가 비어 있어요: 월세, 통신비',
    );
    expect(fail('REASON_REQUIRED').code).toBe('REASON_REQUIRED');
  });

  it('★ 기본 메시지는 전부 한국어 해요체다 — 그대로 화면에 뜬다', () => {
    for (const error of [fail('UNAUTHORIZED'), fail('NOT_MEMBER'), fail('LINE_NOT_FOUND')]) {
      expect(error.message).toMatch(/요\.$/);
      expect(error.message).not.toMatch(/니다/);
    }
  });
});
