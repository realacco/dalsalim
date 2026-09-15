// 기능: F-FAM-10
import type { FastifyBaseLogger } from 'fastify';

import { prisma } from '../lib/db.js';
import { isSettlementDue, localParts } from '../lib/schedule.js';
import { ACTIVE_MEMBER } from '../lib/shared.js';
import { type PushMessage, type PushSender, removeDeadTokens, sendViaExpo } from './push.js';

/** 알림 본문. 판단하지 않는다 (하드룰 9) — 제출했든 안 했든, 늦었든 같은 문장이다 */
export function settlementReminderBody(familyName: string): string {
  return `${familyName} 정산일이에요. 이번 달 살림을 적어볼까요?`;
}

/**
 * 지금 정산일 알림을 받을 사람에게 보내고, 이번 달에 보냈다고 적는다.
 *
 * 구성원(ACTIVE)만 본다 — PENDING · LEFT 는 정산일이 남아 있어도 대상이 아니다 (하드룰 8).
 * 토큰이 하나도 없는 사람도 "보냈다"고 적는다. 안 적으면 같은 날 뒤늦게 기기를 등록하는 순간
 * 알림이 튀어나온다 — 정한 시각에 오는 것만이 알림이다.
 */
export async function runSettlementReminders({
  now = new Date(),
  send = sendViaExpo,
}: { now?: Date; send?: PushSender } = {}) {
  const local = localParts(now);

  const candidates = await prisma.membership.findMany({
    where: { ...ACTIVE_MEMBER, settlementDay: { not: null } },
    include: {
      family: { select: { id: true, name: true } },
      user: { select: { pushTokens: { select: { token: true } } } },
    },
  });
  const due = candidates.filter((m) => isSettlementDue(m, local));

  const messages: PushMessage[] = due.flatMap((m) =>
    m.user.pushTokens.map(({ token }) => ({
      to: token,
      title: '달살림',
      body: settlementReminderBody(m.family.name),
      data: { familyId: m.family.id, yearMonth: local.yearMonth },
    })),
  );

  const { dead } = messages.length > 0 ? await send(messages) : { dead: [] };
  await removeDeadTokens(dead);

  if (due.length > 0) {
    await prisma.membership.updateMany({
      where: { id: { in: due.map((m) => m.id) } },
      data: { settlementNotifiedFor: local.yearMonth },
    });
  }

  return {
    yearMonth: local.yearMonth,
    notified: due.map((m) => ({ membershipId: m.id, tokens: m.user.pushTokens.length })),
    dead: dead.length,
  };
}

const TICK_MS = 60_000;

/**
 * 1분마다 돈다. 겹치지 않게 — 앞 틱이 Expo 응답을 기다리는 동안 다음 틱은 건너뛴다.
 * 별도 큐·크론을 들이지 않는 이유: 가족 몇 명이 쓰는 앱이라 한 틱에 조회 하나면 끝난다.
 */
export function startSettlementScheduler(log: FastifyBaseLogger) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runSettlementReminders();
      if (result.notified.length > 0) log.info(result, '정산일 알림을 보냈어요');
    } catch (error) {
      log.error(error, '정산일 알림을 보내지 못했어요');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), TICK_MS);
  // 이 타이머 때문에 프로세스가 못 끝나면 안 된다 (테스트 · 종료)
  timer.unref();
  return timer;
}
