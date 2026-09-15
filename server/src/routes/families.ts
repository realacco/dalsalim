// 기능: F-FAM-01 F-FAM-02 F-FAM-06 F-FAM-07 F-FAM-08 F-FAM-09 F-FAM-10 F-FIX-05
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireMembership, requireOwner, requireUser } from '../lib/auth.js';
import { settlementOf } from '../lib/schedule.js';
import { displayName, settlement } from '../lib/schemas.js';
import { CATEGORIES } from '../lib/shared.js';
import {
  createFamily,
  getFamilyWithMembers,
  removeMember,
  renameMember,
  rotateInviteCode,
  transferOwnership,
  updateMemberSettlement,
} from '../services/family.js';

/** 가족 · 초대코드 · 구성원. 참여 요청(대기 · 승인 · 거절)은 join-requests.ts 에 있다. */
export async function familyRoutes(app: FastifyInstance) {
  app.get('/categories', async () => ({ categories: CATEGORIES }));

  app.post('/families', async (request) => {
    const user = await requireUser(request);
    const body = z
      .object({ name: z.string().trim().min(1).max(20), displayName })
      .parse(request.body);

    const family = await createFamily(user.id, body.name, body.displayName);
    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  app.get('/families/:familyId', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireMembership(user.id, familyId);

    const family = await getFamilyWithMembers(familyId);
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
        // 남의 정산일도 보인다 — 언제쯤 적을지 서로 아는 것이 이 값의 두 번째 쓸모다 (F-FAM-10)
        settlement: settlementOf(m),
      })),
    };
  });

  /** 초대코드 재발급 — OWNER 전용. 바뀐 리소스는 그 리소스로 (가족 만들기와 같은 모양) */
  app.post('/families/:familyId/invite-code', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    await requireOwner(user.id, familyId);

    const family = await rotateInviteCode(familyId);
    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  /** 내 표시 이름 (F-FAM-07) · 내 정산일 (F-FAM-10). 보낸 칸만 바꾼다 */
  app.patch('/families/:familyId/me', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const body = z
      .object({ displayName: displayName.optional(), settlement: settlement.optional() })
      .parse(request.body);
    const mine = await requireMembership(user.id, familyId);

    let updated = mine;
    if (body.displayName !== undefined) updated = await renameMember(mine.id, body.displayName);
    if (body.settlement !== undefined)
      updated = await updateMemberSettlement(mine.id, body.settlement);
    return {
      membership: {
        id: updated.id,
        displayName: updated.displayName,
        settlement: settlementOf(updated),
      },
    };
  });

  /** 가족에서 빼기 — 본인이면 나가기, OWNER 가 남을 지목하면 내보내기 */
  app.delete('/families/:familyId/members/:membershipId', async (request) => {
    const user = await requireUser(request);
    const params = z
      .object({ familyId: z.string(), membershipId: z.string() })
      .parse(request.params);
    const mine = await requireMembership(user.id, params.familyId);

    const target = await removeMember(params.familyId, mine, params.membershipId);
    return { ok: true, membershipId: target.id };
  });

  /** 가족장 넘기기 — OWNER 전용 */
  app.post('/families/:familyId/transfer-owner', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const body = z.object({ membershipId: z.string() }).parse(request.body);
    const mine = await requireOwner(user.id, familyId);

    const target = await transferOwnership(familyId, mine, body.membershipId);
    return { ok: true, ownerMembershipId: target.id };
  });
}
