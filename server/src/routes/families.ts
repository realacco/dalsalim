import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../lib/db.js';
import { generateInviteCode } from '../services/family.js';
import { requireMembership, requireOwner, requireUser } from '../lib/auth.js';
import { conflict, notFound } from '../lib/http.js';
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

    if (family.memberships.some((m) => m.userId === user.id)) {
      throw conflict('ALREADY_MEMBER', '이미 참여한 가족입니다.');
    }

    await prisma.membership.create({
      data: {
        familyId: family.id,
        userId: user.id,
        displayName: body.displayName,
        role: 'MEMBER',
        sortOrder: family.memberships.length,
      },
    });

    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  app.get('/families/:familyId', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireMembership(user.id, familyId);

    const family = await prisma.family.findUniqueOrThrow({
      where: { id: familyId },
      include: { memberships: { include: { user: true }, orderBy: { sortOrder: 'asc' } } },
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
}
