import { type ErrorCode, messageFor, statusFor } from './messages.js';

/**
 * 클라이언트에 그대로 노출해도 되는 에러. 전역 핸들러가 이 클래스인지로 "보여줘도 되는가"를 가른다.
 * 코드와 문장은 lib/messages 에서만 온다 — 라우트가 문장을 지어내지 않는다.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 실패를 만든다. `throw fail('OWNER_ONLY')`.
 * detail 은 함수형 메시지(비어 있는 항목 이름 등)에만 쓰인다.
 */
export function fail(code: ErrorCode, detail?: string): AppError {
  return new AppError(statusFor(code), code, messageFor(code, detail));
}
