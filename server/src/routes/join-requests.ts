import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireOwner, requireUser } from '../lib/auth.js';
import {
  approveJoinRequest,
  cancelJoinRequest,
  listJoinRequests,
  listMyPendingRequests,
  rejectJoinRequest,
  requestJoin,
} from '../services/family.js';
import { displayName } from '../lib/schemas.js';

/**
 * 초대코드 입력은 전역 한도보다 훨씬 좁게 잡는다.
 *
 * 코드가 6자리(헷갈리는 글자를 뺀 32글자 알파벳)라 조합 자체는 많지만, 한 사람이 코드를
 * 계속 찍어보는 걸 그냥 두면 안 된다. 사람이 1분에 10번 넘게 잘못 입력할 일은 없다.
 */
const JOIN_LIMIT = { max: 10, timeWindow: '1 minute' } as const;

/**
 * 참여 요청 — 코드를 맞힌 사람은 PENDING 으로 들어오고, 가족장이 승인해야 구성원이 된다 (하드룰 8).
 * family 도메인이지만 "가족 안"이 아니라 "가족 문 앞"의 일이라 파일을 나눴다.
 */
export async function joinRequestRoutes(app: FastifyInstance) {
  app.post('/families/join', { config: { rateLimit: JOIN_LIMIT } }, async (request) => {
    const user = await requireUser(request);
    const body = z
      .object({ inviteCode: z.string().trim().toUpperCase().length(6), displayName })
      .parse(request.body);

    const { membership, family } = await requestJoin(user.id, body.inviteCode, body.displayName);

    // 아직 구성원이 아니므로 가족 이름 말고는 알려주지 않는다.
    // 초대코드를 돌려주면 승인도 안 난 사람이 그 코드를 퍼뜨릴 수 있다.
    // 만들어진 리소스는 그 리소스로 돌려준다 (응답 형태 규칙) — 대기 중인 멤버십이다
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
    const pending = await listMyPendingRequests(user.id);

    return {
      requests: pending.map((m) => ({
        membershipId: m.id,
        displayName: m.displayName,
        requestedAt: m.requestedAt,
        family: { id: m.familyId, name: m.family.name },
      })),
    };
  });

  app.delete('/families/pending/:membershipId', async (request) => {
    const user = await requireUser(request);
    const { membershipId } = z.object({ membershipId: z.string() }).parse(request.params);

    await cancelJoinRequest(user.id, membershipId);
    return { ok: true };
  });

  /** 들어온 참여 요청 목록 — OWNER 전용 */
  app.get('/families/:familyId/join-requests', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    await requireOwner(user.id, familyId);

    const requests = await listJoinRequests(familyId);
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

  app.post('/families/:familyId/join-requests/:membershipId/approve', async (request) => {
    const user = await requireUser(request);
    const params = z
      .object({ familyId: z.string(), membershipId: z.string() })
      .parse(request.params);
    await requireOwner(user.id, params.familyId);

    const target = await approveJoinRequest(params.familyId, params.membershipId);
    return { ok: true, membershipId: target.id };
  });

  app.post('/families/:familyId/join-requests/:membershipId/reject', async (request) => {
    const user = await requireUser(request);
    const params = z
      .object({ familyId: z.string(), membershipId: z.string() })
      .parse(request.params);
    await requireOwner(user.id, params.familyId);

    const target = await rejectJoinRequest(params.familyId, params.membershipId);
    return { ok: true, membershipId: target.id };
  });
}
