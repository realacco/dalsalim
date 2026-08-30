import jwt from 'jsonwebtoken';
import type { FastifyRequest } from 'fastify';

import { env } from '../env.js';
import { prisma } from './db.js';
import { forbidden, notFound, unauthorized } from './http.js';

export type TokenPayload = { sub: string };

export function issueToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies TokenPayload, env.jwtSecret, { expiresIn: '90d' });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.jwtSecret) as TokenPayload;
  } catch {
    throw unauthorized('토큰이 유효하지 않습니다.');
  }
}

/** Authorization 헤더에서 사용자를 꺼낸다. 없거나 잘못됐으면 401. */
export async function requireUser(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();

  const { sub } = verifyToken(header.slice('Bearer '.length));
  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user) throw unauthorized('탈퇴했거나 없는 사용자입니다.');

  return user;
}

/** 이 사용자가 그 가족의 멤버인지 확인하고 멤버십을 돌려준다. */
export async function requireMembership(userId: string, familyId: string) {
  const membership = await prisma.membership.findUnique({
    where: { familyId_userId: { familyId, userId } },
  });

  // 나갔거나 내보내진 사람은 더 이상 구성원이 아니다 (기록은 남아 있어도)
  if (!membership || !membership.active) throw forbidden('이 가족의 구성원이 아닙니다.');
  return membership;
}

export async function requireOwner(userId: string, familyId: string) {
  const membership = await requireMembership(userId, familyId);
  if (membership.role !== 'OWNER') throw forbidden('가족장만 할 수 있습니다.');
  return membership;
}

/** 내 기록인지 확인하고 돌려준다. 남의 기록은 열람도 수정도 막는다. */
export async function requireOwnEntry(userId: string, entryId: string) {
  const entry = await prisma.memberEntry.findUnique({
    where: { id: entryId },
    include: { membership: true, book: true },
  });

  if (!entry) throw notFound('기록을 찾을 수 없습니다.');
  if (entry.membership.userId !== userId) throw forbidden('본인의 기록만 수정할 수 있습니다.');

  return entry;
}

/** 카카오 인가 코드를 액세스 토큰으로 바꾸고 사용자 정보를 가져온다. */
export async function fetchKakaoProfile(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: env.kakao.restApiKey,
    redirect_uri: redirectUri,
    code,
  });

  if (env.kakao.clientSecret) body.set('client_secret', env.kakao.clientSecret);

  const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });

  if (!tokenResponse.ok) {
    throw unauthorized(`카카오 토큰 발급 실패: ${await tokenResponse.text()}`);
  }

  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token: string };

  const meResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!meResponse.ok) {
    throw unauthorized(`카카오 프로필 조회 실패: ${await meResponse.text()}`);
  }

  const me = (await meResponse.json()) as {
    id: number;
    kakao_account?: { profile?: { nickname?: string; profile_image_url?: string } };
  };

  return {
    kakaoId: String(me.id),
    nickname: me.kakao_account?.profile?.nickname ?? '이름 없음',
    profileImageUrl: me.kakao_account?.profile?.profile_image_url ?? null,
  };
}
