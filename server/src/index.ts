import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';

import { env, kakaoConfigured } from './env.js';
import { AppError } from './lib/http.js';
import { authRoutes } from './routes/auth.js';
import { familyRoutes } from './routes/families.js';
import { fixedExpenseRoutes } from './routes/fixedExpenses.js';
import { bookRoutes } from './routes/books.js';
import { entryRoutes } from './routes/entries.js';

const app = Fastify({
  logger: { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } },
});

await app.register(cors, { origin: true });

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
      .send({ code: 'VALIDATION', message: error.issues[0]?.message ?? '입력값을 확인해주세요.' });
  }

  app.log.error(error);
  return reply.status(500).send({ code: 'INTERNAL', message: '서버에서 문제가 발생했습니다.' });
});

app.get('/health', async () => ({ ok: true, kakao: kakaoConfigured, devLogin: env.devLogin }));

await app.register(authRoutes);
await app.register(familyRoutes);
await app.register(fixedExpenseRoutes);
await app.register(bookRoutes);
await app.register(entryRoutes);

await app.listen({ port: env.port, host: env.host });

app.log.info(`달살림 서버 · ${env.publicBaseUrl}`);
if (!kakaoConfigured) {
  app.log.warn('카카오 키가 없습니다. 개발용 로그인(POST /auth/dev)만 쓸 수 있습니다.');
}
