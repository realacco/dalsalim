/** 클라이언트에 그대로 노출해도 되는 에러 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string) => new AppError(400, code, message);
export const unauthorized = (message = '로그인이 필요합니다.') =>
  new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = '권한이 없습니다.', code = 'FORBIDDEN') =>
  new AppError(403, code, message);
export const notFound = (message = '찾을 수 없습니다.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const tooManyRequests = () =>
  new AppError(429, 'RATE_LIMITED', '요청이 너무 잦습니다. 잠시 후 다시 시도해주세요.');
