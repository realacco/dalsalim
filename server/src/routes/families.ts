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
import { CATEGORIES } from '../lib/shared.js';

const displayName = z.string().trim().min(1, '이름을 입력해주세요.').max(20);

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

  /** 초대코드로 참여하기 */
  app.post('/families/join', async (request) => {
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

    if (existing?.active) {
      throw conflict('ALREADY_MEMBER', '이미 참여한 가족입니다.');
    }

    if (existing) {
      // 나갔던 사람이 돌아왔다. (familyId, userId) 가 unique 라 새로 만들 수 없고,
      // 지난 기록이 이 멤버십에 매달려 있으므로 되살리는 게 맞다.
      await prisma.membership.update({
        where: { id: existing.id },
        data: { active: true, leftAt: null, displayName: body.displayName },
      });
    } else {
      await prisma.membership.create({
        data: {
          familyId: family.id,
          userId: user.id,
          displayName: body.displayName,
          role: 'MEMBER',
          sortOrder: family.memberships.length,
        },
      });
    }

    // 사람이 늘면 "전원 제출"에 필요한 정원도 늘어난다. 다시 계산하지 않으면
    // 먼저 있던 사람들만으로 완성돼 있던 장부가 완성인 채로 남는다 —
    // 방금 들어온 사람은 한 줄도 안 적었는데 홈에 '완성' 배지가 뜬다.
    await refreshFamilyBooks(family.id);

    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  app.get('/families/:familyId', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireMembership(user.id, familyId);

    const family = await prisma.family.findUniqueOrThrow({
      where: { id: familyId },
      include: {
        memberships: {
          where: { active: true },
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

    return { inviteCode: family.inviteCode };
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
    if (!target || target.familyId !== params.familyId || !target.active) {
      throw notFound('그런 구성원이 없습니다.');
    }

    const isSelf = target.id === mine.id;
    if (!isSelf && mine.role !== 'OWNER') {
      throw forbidden('가족장만 구성원을 내보낼 수 있습니다.');
    }

    const activeCount = await prisma.membership.count({
      where: { familyId: params.familyId, active: true },
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
    if (!target || target.familyId !== familyId || !target.active) {
      throw notFound('그런 구성원이 없습니다.');
    }
    if (target.id === mine.id) {
      throw badRequest('ALREADY_OWNER', '이미 가족장이에요.');
    }

    await transferOwner(mine.id, target.id);
    return { ok: true, ownerMembershipId: target.id };
  });
}
