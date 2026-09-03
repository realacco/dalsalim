import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../lib/db.js';
import {
  deactivateMember,
  generateInviteCode,
  refreshFamilyBooks,
  transferOwner,
} from '../services/family.js';
import { requireMembership, requireOwner, requireUser } from '../lib/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { ACTIVE_MEMBER, CATEGORIES } from '../lib/shared.js';

const displayName = z.string().trim().min(1, '이름을 입력해주세요.').max(20);

/**
 * 초대코드 입력은 전역 한도보다 훨씬 좁게 잡는다.
 *
 * 코드가 6자리(헷갈리는 글자를 뺀 32글자 알파벳)라 조합 자체는 많지만, 한 사람이 코드를
 * 계속 찍어보는 걸 그냥 두면 안 된다. 사람이 1분에 10번 넘게 잘못 입력할 일은 없다.
 */
const JOIN_LIMIT = { max: 10, timeWindow: '1 minute' } as const;

export async function familyRoutes(app: FastifyInstance) {
  app.get('/categories', async () => ({ categories: CATEGORIES }));

  /** 가족 만들기 — 만든 사람이 OWNER 가 된다 */
  app.post('/families', async (request) => {
    const user = await requireUser(request);
    const body = z
      .object({ name: z.string().trim().min(1).max(20), displayName })
      .parse(request.body);

    const family = await prisma.family.create({
      data: {
        name: body.name,
        inviteCode: await generateInviteCode(),
        memberships: {
          create: { userId: user.id, displayName: body.displayName, role: 'OWNER', sortOrder: 0 },
        },
      },
    });

    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  /**
   * 초대코드로 참여 요청하기.
   *
   * ★ 여기서 바로 구성원이 되지 않는다. PENDING 으로 들어가고 가족장이 승인해야 ACTIVE 가 된다.
   *   초대코드는 카톡으로 오가는 문자열이라 언제든 새어나갈 수 있는데,
   *   그것 하나로 남의 가계부가 통째로 열리면 안 된다.
   */
  app.post('/families/join', { config: { rateLimit: JOIN_LIMIT } }, async (request) => {
    const user = await requireUser(request);
    const body = z
      .object({ inviteCode: z.string().trim().toUpperCase().length(6), displayName })
      .parse(request.body);

    const family = await prisma.family.findUnique({
      where: { inviteCode: body.inviteCode },
      include: { memberships: true },
    });

    if (!family) throw notFound('그런 초대코드를 가진 가족이 없습니다.');

    const existing = family.memberships.find((m) => m.userId === user.id);

    if (existing?.status === 'ACTIVE') {
      throw conflict('ALREADY_MEMBER', '이미 참여한 가족입니다.');
    }
    if (existing?.status === 'PENDING') {
      throw conflict('ALREADY_REQUESTED', '이미 참여를 요청했어요. 가족장의 승인을 기다려주세요.');
    }

    let membership;
    if (existing) {
      // 나갔던 사람이 돌아왔다. (familyId, userId) 가 unique 라 새로 만들 수 없고,
      // 지난 기록이 이 멤버십에 매달려 있으므로 되살리는 게 맞다.
      // 나갔던 사람도 다시 승인을 받는다 — 내보낸 사람이 코드만으로 돌아오면 안 되니까.
      membership = await prisma.membership.update({
        where: { id: existing.id },
        data: {
          status: 'PENDING',
          requestedAt: new Date(),
          leftAt: null,
          displayName: body.displayName,
        },
      });
    } else {
      membership = await prisma.membership.create({
        data: {
          familyId: family.id,
          userId: user.id,
          displayName: body.displayName,
          role: 'MEMBER',
          status: 'PENDING',
          requestedAt: new Date(),
          sortOrder: family.memberships.length,
        },
      });
    }

    // 아직 구성원이 아니므로 가족 이름 말고는 알려주지 않는다.
    // 초대코드를 돌려주면 승인도 안 난 사람이 그 코드를 퍼뜨릴 수 있다.
    // 만들어진 리소스는 그 리소스로 돌려준다 (CLAUDE.md 응답 형태 규칙) — 대기 중인 멤버십이다
    return {
      membership: {
        id: membership.id,
        status: 'PENDING' as const,
        displayName: membership.displayName,
        family: { id: family.id, name: family.name },
      },
    };
  });

  /**
   * 내가 승인을 기다리고 있는 가족. 대기 화면이 "어느 가족인지"를 그리는 데 쓴다.
   * 아직 구성원이 아니라서 GET /families/:familyId 로는 읽을 수 없다.
   */
  app.get('/families/pending', async (request) => {
    const user = await requireUser(request);

    const pending = await prisma.membership.findMany({
      where: { userId: user.id, status: 'PENDING' },
      include: { family: true },
      orderBy: { requestedAt: 'asc' },
    });

    return {
      requests: pending.map((m) => ({
        membershipId: m.id,
        displayName: m.displayName,
        requestedAt: m.requestedAt,
        family: { id: m.familyId, name: m.family.name },
      })),
    };
  });

  /** 기다리다 지쳤거나 코드를 잘못 넣었을 때, 요청을 스스로 무른다 */
  app.delete('/families/pending/:membershipId', async (request) => {
    const user = await requireUser(request);
    const { membershipId } = z.object({ membershipId: z.string() }).parse(request.params);

    const mine = await prisma.membership.findUnique({ where: { id: membershipId } });
    if (!mine || mine.userId !== user.id || mine.status !== 'PENDING') {
      throw notFound('그런 참여 요청이 없습니다.');
    }

    // 승인 전이라 이 멤버십에 매달린 기록이 없다. 되살릴 게 없으니 그냥 지운다.
    await prisma.membership.delete({ where: { id: mine.id } });
    return { ok: true };
  });

  /** 들어온 참여 요청 목록 — OWNER 전용 */
  app.get('/families/:familyId/join-requests', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    await requireOwner(user.id, familyId);

    const requests = await prisma.membership.findMany({
      where: { familyId, status: 'PENDING' },
      include: { user: true },
      orderBy: { requestedAt: 'asc' },
    });

    return {
      requests: requests.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        nickname: m.user.nickname,
        profileImageUrl: m.user.profileImageUrl,
        requestedAt: m.requestedAt,
      })),
    };
  });

  /** 참여 요청 승인 — OWNER 전용 */
  app.post('/families/:familyId/join-requests/:membershipId/approve', async (request) => {
    const user = await requireUser(request);
    const params = z
      .object({ familyId: z.string(), membershipId: z.string() })
      .parse(request.params);

    await requireOwner(user.id, params.familyId);

    const target = await prisma.membership.findUnique({ where: { id: params.membershipId } });
    if (!target || target.familyId !== params.familyId || target.status !== 'PENDING') {
      throw notFound('그런 참여 요청이 없습니다.');
    }

    await prisma.membership.update({
      where: { id: target.id },
      data: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null },
    });

    // 사람이 늘면 "전원 제출"에 필요한 정원도 늘어난다. 다시 계산하지 않으면
    // 먼저 있던 사람들만으로 완성돼 있던 장부가 완성인 채로 남는다 —
    // 방금 들어온 사람은 한 줄도 안 적었는데 홈에 '완성' 배지가 뜬다.
    await refreshFamilyBooks(params.familyId);

    return { ok: true, membershipId: target.id };
  });

  /** 참여 요청 거절 — OWNER 전용 */
  app.post('/families/:familyId/join-requests/:membershipId/reject', async (request) => {
    const user = await requireUser(request);
    const params = z
      .object({ familyId: z.string(), membershipId: z.string() })
      .parse(request.params);

    await requireOwner(user.id, params.familyId);

    const target = await prisma.membership.findUnique({ where: { id: params.membershipId } });
    if (!target || target.familyId !== params.familyId || target.status !== 'PENDING') {
      throw notFound('그런 참여 요청이 없습니다.');
    }

    // 승인 전이라 매달린 기록이 없다. LEFT 로 남기면 "한때 구성원이었던 사람"으로
    // 잘못 읽히고 다시 요청할 때도 걸리적거린다. 지우는 게 맞다.
    await prisma.membership.delete({ where: { id: target.id } });
    return { ok: true, membershipId: target.id };
  });

  app.get('/families/:familyId', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireMembership(user.id, familyId);

    const family = await prisma.family.findUniqueOrThrow({
      where: { id: familyId },
      include: {
        memberships: {
          where: ACTIVE_MEMBER,
          include: { user: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    return {
      family: { id: family.id, name: family.name, inviteCode: family.inviteCode },
      myMembershipId: mine.id,
      members: family.memberships.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        role: m.role,
        nickname: m.user.nickname,
        profileImageUrl: m.user.profileImageUrl,
        isMe: m.userId === user.id,
      })),
    };
  });

  /** 초대코드 재발급 — 예전 코드를 아는 사람을 막고 싶을 때. OWNER 전용 */
  app.post('/families/:familyId/invite-code', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    await requireOwner(user.id, familyId);

    const family = await prisma.family.update({
      where: { id: familyId },
      data: { inviteCode: await generateInviteCode() },
    });

    // 바뀐 리소스는 그 리소스로 — 가족 만들기와 같은 모양이라 앱이 한 타입으로 받는다
    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  /** 내 표시 이름 바꾸기 */
  app.patch('/families/:familyId/me', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const body = z.object({ displayName }).parse(request.body);
    const mine = await requireMembership(user.id, familyId);

    const updated = await prisma.membership.update({
      where: { id: mine.id },
      data: { displayName: body.displayName },
    });

    return { membership: { id: updated.id, displayName: updated.displayName } };
  });

  /**
   * 가족에서 빼기 — 본인이면 나가기, OWNER 가 남을 지목하면 내보내기.
   *
   * 이게 없으면 안 쓰는 멤버 한 명이 장부를 영원히 막는다. 잘못 초대한 사람도 뺄 수 없다.
   */
  app.delete('/families/:familyId/members/:membershipId', async (request) => {
    const user = await requireUser(request);
    const params = z
      .object({ familyId: z.string(), membershipId: z.string() })
      .parse(request.params);

    const mine = await requireMembership(user.id, params.familyId);

    const target = await prisma.membership.findUnique({ where: { id: params.membershipId } });
    if (!target || target.familyId !== params.familyId || target.status !== 'ACTIVE') {
      throw notFound('그런 구성원이 없습니다.');
    }

    const isSelf = target.id === mine.id;
    if (!isSelf && mine.role !== 'OWNER') {
      throw forbidden('가족장만 구성원을 내보낼 수 있습니다.');
    }

    const activeCount = await prisma.membership.count({
      where: { familyId: params.familyId, ...ACTIVE_MEMBER },
    });

    // 가족장이 그냥 나가면 주인 없는 가족이 남는다. 남은 사람이 있으면 먼저 넘겨야 한다.
    if (target.role === 'OWNER' && activeCount > 1) {
      throw badRequest(
        'TRANSFER_OWNER_FIRST',
        '가족장을 다른 구성원에게 넘긴 뒤에 나갈 수 있어요.',
      );
    }

    await deactivateMember(params.familyId, target.id);
    return { ok: true, membershipId: target.id };
  });

  /** 가족장 넘기기 — OWNER 전용 */
  app.post('/families/:familyId/transfer-owner', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const body = z.object({ membershipId: z.string() }).parse(request.body);

    const mine = await requireOwner(user.id, familyId);

    const target = await prisma.membership.findUnique({ where: { id: body.membershipId } });
    if (!target || target.familyId !== familyId || target.status !== 'ACTIVE') {
      throw notFound('그런 구성원이 없습니다.');
    }
    if (target.id === mine.id) {
      throw badRequest('ALREADY_OWNER', '이미 가족장이에요.');
    }

    await transferOwner(mine.id, target.id);
    return { ok: true, ownerMembershipId: target.id };
  });
}
