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
 *
 * 표시는 **보낸 뒤에** 적는다. Expo 응답을 기다리다 프로세스가 죽으면 다음 틱에 한 번 더 갈 수 있다 —
 * 반대로 먼저 적으면 "보냈다고 적고 못 보낸" 쪽이 되는데, 한 달에 한 번 오는 알림은 안 오는 쪽이 더 나쁘다.
 * 같은 이유로 서버 복제본은 하나여야 한다 (Railway 1개). 둘이 같은 틱을 돌면 둘 다 보낸다.
 * 토큰이 100개를 넘어 청크가 여럿일 때 뒤 청크가 실패하면 앞 청크 수신자는 다음 틱에 한 번 더 받는다 — 같은 한계다.
 * Expo 에 못 닿는 상태가 이어지면 (5xx · 네트워크) 날이 바뀔 때까지 매분 다시 시도하고 매분 error 로그가 남는다 —
 * 그게 "보내는 쪽이 살아나면 그날 안에는 간다" 의 값이다. Expo 가 받고 거절한 것은 push.ts 가 던지지 않고 failed 로 눕힌다.
 */
export async function runSettlementReminders({
  now = new Date(),
  send = sendViaExpo,
  familyId,
}: { now?: Date; send?: PushSender; familyId?: string } = {}) {
  const local = localParts(now);

  /*
    familyId 는 **개발용 라우트만** 넘긴다. 진짜 스케줄러는 안 넘겨 DB 전체를 돈다.
    시각을 미래로 돌려보는 것이 이 표시를 진짜로 적기 때문에, 좁히지 않으면 로컬 스모크가
    같은 DB 의 다른 가족(시드 · 개발자 본인)에게도 "그 달엔 보냈다" 를 박아
    그 사람의 진짜 알림을 그 달 내내 막는다. 증상이 "안 오는 것" 이라 눈치채기도 어렵다
  */
  const candidates = await prisma.membership.findMany({
    where: { ...ACTIVE_MEMBER, settlementDay: { not: null }, ...(familyId ? { familyId } : {}) },
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
      // 앱은 familyId 만 읽는다. 밖으로 나가는 것은 CLAUDE.md 보안 규칙의 예외 목록 넷뿐이다
      data: { familyId: m.family.id },
    })),
  );

  const { dead, failed, shortTickets } =
    messages.length > 0 ? await send(messages) : { dead: [], failed: [], shortTickets: 0 };
  /*
    보낸 뒤에 적는다 — 그 사이에 다른 쓰기를 끼우지 않는다.
    죽은 토큰 정리가 먼저 있을 때는 거기서 DB 가 튀면 due 전원이 표시를 못 받고,
    다음 틱에 이미 받은 사람까지 진짜 푸시를 한 번 더 받았다. 정리는 이번 달 판정과 무관하니 뒤로 둔다
  */
  if (due.length > 0) {
    await prisma.membership.updateMany({
      where: { id: { in: due.map((m) => m.id) } },
      data: { settlementNotifiedFor: local.yearMonth },
    });
  }
  await removeDeadTokens(dead);

  return {
    yearMonth: local.yearMonth,
    notified: due.map((m) => ({ membershipId: m.id, tokens: m.user.pushTokens.length })),
    dead: dead.length,
    /** 못 간 기기. 비어 있지 않으면 스케줄러가 경고로 찍는다 — 삼키면 아무도 모른다 */
    failed,
    /** Expo 가 표를 안 준 통의 수. 0 이 아니면 "보냈다"고 적혔지만 갔는지 모르는 통이 있다는 뜻 */
    shortTickets,
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
      if (result.failed.length > 0 || result.shortTickets > 0) {
        log.warn(result, '정산일 알림이 일부 기기에 못 갔어요');
      } else if (result.notified.length > 0) log.info(result, '정산일 알림을 보냈어요');
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
