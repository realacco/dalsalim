import type { FastifyReply } from 'fastify';

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
export const forbidden = (message = '권한이 없습니다.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = '찾을 수 없습니다.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ code: error.code, message: error.message });
  }

  reply.log.error(error);
  return reply.status(500).send({ code: 'INTERNAL', message: '서버에서 문제가 발생했습니다.' });
}
