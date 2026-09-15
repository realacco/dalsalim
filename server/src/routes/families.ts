// 기능: F-FAM-01 F-FAM-02 F-FAM-06 F-FAM-07 F-FAM-08 F-FAM-09 F-FAM-11 F-FIX-05
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireMembership, requireOwner, requireUser } from '../lib/auth.js';
import { displayName } from '../lib/schemas.js';
import { CATEGORIES } from '../lib/shared.js';
import {
  countFamilyContents,
  createFamily,
  deleteFamily,
  getFamilyWithMembers,
  removeMember,
  renameMember,
  rotateInviteCode,
  transferOwnership,
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

    const [family, contents] = await Promise.all([
      getFamilyWithMembers(familyId),
      // 없애기 확인 다이얼로그가 읽는다 (F-FAM-11). 가족장이 아니어도 실어 보낸다 —
      // 응답 모양이 사람마다 달라지면 앱이 그때그때 다른 타입을 다뤄야 한다
      countFamilyContents(familyId),
    ]);
    return {
      family: { id: family.id, name: family.name, inviteCode: family.inviteCode },
      contents,
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

  /** 초대코드 재발급 — OWNER 전용. 바뀐 리소스는 그 리소스로 (가족 만들기와 같은 모양) */
  app.post('/families/:familyId/invite-code', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    await requireOwner(user.id, familyId);

    const family = await rotateInviteCode(familyId);
    return { family: { id: family.id, name: family.name, inviteCode: family.inviteCode } };
  });

  /** 내 표시 이름 바꾸기 */
  app.patch('/families/:familyId/me', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const body = z.object({ displayName }).parse(request.body);
    const mine = await requireMembership(user.id, familyId);

    const updated = await renameMember(mine.id, body.displayName);
    return { membership: { id: updated.id, displayName: updated.displayName } };
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

  /**
   * 가족 없애기 (F-FAM-11) — 혼자 남은 가족장만. 구성원이 남아 있으면 서비스가 막는다.
   * 리소스가 없어지는 동작이라 { ok: true } 다. 이어서 쓸 id 도 없다 — 가족 자체가 사라진다.
   */
  app.delete('/families/:familyId', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireOwner(user.id, familyId);

    await deleteFamily(familyId, mine.id);
    return { ok: true };
  });
}
