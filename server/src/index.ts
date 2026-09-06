import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';

import { env, kakaoConfigured } from './env.js';
import { rateLimitKey } from './lib/auth.js';
import { AppError, fail } from './lib/http.js';
import { messageFor } from './lib/messages.js';
import { authRoutes } from './routes/auth.js';
import { familyRoutes } from './routes/families.js';
import { joinRequestRoutes } from './routes/join-requests.js';
import { fixedExpenseRoutes } from './routes/fixedExpenses.js';
import { bookRoutes } from './routes/books.js';
import { entryRoutes } from './routes/entries.js';

const app = Fastify({
  logger: { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } },
});

await app.register(cors, { origin: true });

/**
 * 기본 레이트리밋.
 *
 * 가족 몇 명이 쓰는 앱이라 평소에는 절대 걸릴 일이 없는 숫자로 잡는다. 목적은 과금 방어가 아니라
 * 초대코드/로그인 무차별 대입을 사람 손 속도로 묶어두는 것이다. 더 좁혀야 하는 라우트는
 * 각자 config.rateLimit 으로 따로 조인다 (families.ts 의 /families/join 등).
 *
 * 키는 로그인한 사람이면 사용자 id, 아니면 IP 다. 한 집에서 여러 명이 같은 공유기를 쓰기 때문에
 * IP 로만 묶으면 가족끼리 서로의 한도를 갉아먹는다.
 */
await app.register(rateLimit, {
  global: true,
  max: 300,
  timeWindow: '1 minute',
  keyGenerator: (request) => rateLimitKey(request),
  // 이 플러그인은 한도 초과를 "에러로 던진다". 평범한 객체를 돌려주면 아래 에러 핸들러가
  // 알아보지 못하고 500 으로 뭉개버린다 — AppError 로 만들어 같은 경로를 타게 한다.
  errorResponseBuilder: () => fail('RATE_LIMITED'),
});

// /submit 처럼 본문이 없는 POST 가 여럿이다. 빈 본문을 에러로 보지 않는다.
app.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (_request, body: string, done) => {
    if (!body || body.trim() === '') return done(null, {});
    try {
      done(null, JSON.parse(body));
    } catch (error) {
      done(error as Error, undefined);
    }
  },
);

app.setErrorHandler((error, _request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({ code: error.code, message: error.message });
  }

  // zod 메시지를 그대로 사용자에게 보여준다 (전부 한국어로 써 두었다)
  if (error instanceof ZodError) {
    return reply
      .status(400)
      .send({ code: 'VALIDATION', message: error.issues[0]?.message ?? messageFor('VALIDATION') });
  }

  app.log.error(error);
  return reply.status(500).send({ code: 'INTERNAL', message: messageFor('INTERNAL') });
});

app.get('/health', async () => ({ ok: true, kakao: kakaoConfigured, devLogin: env.devLogin }));

await app.register(authRoutes);
await app.register(familyRoutes);
await app.register(joinRequestRoutes);
await app.register(fixedExpenseRoutes);
await app.register(bookRoutes);
await app.register(entryRoutes);

await app.listen({ port: env.port, host: env.host });

app.log.info(`달살림 서버 · ${env.publicBaseUrl}`);
if (!kakaoConfigured) {
  app.log.warn('카카오 키가 없어요. 개발용 로그인(POST /auth/dev)만 쓸 수 있어요.');
}
