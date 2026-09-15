// 기능: F-FAM-10
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { env } from '../env.js';
import { requireUser } from '../lib/auth.js';
import { pushToken } from '../lib/schemas.js';
import { type PushMessage, registerPushToken, removePushToken } from '../services/push.js';
import { runSettlementReminders } from '../services/settlement-reminder.js';

/** 알림을 받을 기기 등록·해제. 정산일 자체는 가족 안의 일이라 families.ts (PATCH …/me) 에 있다. */
export async function notificationRoutes(app: FastifyInstance) {
  /** 이 기기를 알림 받을 기기로. 리소스로 표현되지 않는 동작이라 { ok } */
  app.put('/me/push-token', async (request) => {
    const user = await requireUser(request);
    const body = z
      .object({ token: pushToken, platform: z.enum(['android', 'ios']) })
      .parse(request.body);

    await registerPushToken(user.id, body.token, body.platform);
    return { ok: true };
  });

  /** 로그아웃할 때 그 기기를 무른다 — 다음 사람이 같은 폰으로 로그인해도 내 알림이 안 간다 */
  app.delete('/me/push-token', async (request) => {
    const user = await requireUser(request);
    const body = z.object({ token: pushToken }).parse(request.body);

    await removePushToken(user.id, body.token);
    return { ok: true };
  });

  /**
   * 스케줄러를 "지금"이 아닌 시각으로 돌려본다 — 스모크가 말일 보정 · 한 달 한 번을 검증하는 길.
   * 개발 전용이라 /auth/dev 와 같은 조건으로만 열린다 (운영에서는 라우트 자체가 없다).
   * 실제로 보내지는 않지만 "이번 달에 보냈다"는 표시(settlementNotifiedFor)는 **남는다** —
   * 스모크가 "같은 달엔 두 번 안 간다"를 보려면 그래야 한다. 미래 달로 돌려보면 그 달의 진짜 알림이 막힌다.
   */
  if (env.devLogin) {
    app.post('/dev/reminders/run', async (request) => {
      await requireUser(request);
      const { now } = z.object({ now: z.iso.datetime().optional() }).parse(request.body);

      const sent: PushMessage[] = [];
      const result = await runSettlementReminders({
        now: now ? new Date(now) : new Date(),
        send: async (messages) => {
          sent.push(...messages);
          return { dead: [], failed: [], shortTickets: 0 };
        },
      });
      return { ...result, messages: sent.map(({ to, body }) => ({ to, body })) };
    });
  }
}
