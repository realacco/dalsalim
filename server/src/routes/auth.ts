import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { env, kakaoConfigured } from '../env.js';
import { prisma } from '../lib/db.js';
import { fetchKakaoProfile, issueToken, requireUser } from '../lib/auth.js';
import { badRequest, unauthorized } from '../lib/http.js';

/**
 * 카카오 로그인은 앱이 아니라 서버가 주도한다.
 *
 *   앱 ──(브라우저)──▶ GET /auth/kakao/start?returnUrl=...
 *                        └─▶ 302 kauth.kakao.com/oauth/authorize
 *   사용자 동의
 *   카카오 ──▶ GET /auth/kakao/callback?code&state
 *                └─ 코드 교환 · 사용자 upsert · JWT 발급
 *                └─▶ 302 returnUrl?token=...      (앱이 이 URL을 받아 토큰을 꺼낸다)
 *
 * 이 구조를 택한 이유:
 *  - 카카오 REST 키와 client_secret 이 앱 번들에 들어가지 않는다
 *  - 네이티브 SDK 가 필요 없어 Expo Go 로 바로 테스트된다 (네이티브 빌드 22분 회피)
 *  - redirect_uri 를 서버 주소 하나로 고정할 수 있어 카카오 콘솔 등록이 간단하다
 */

const REDIRECT_PATH = '/auth/kakao/callback';

/**
 * 로그인 계열은 전역 한도(분당 300)보다 훨씬 좁게 잡는다.
 * 사람이 로그인을 1분에 10번 넘게 누를 일은 없다.
 */
const SENSITIVE_LIMIT = { max: 10, timeWindow: '1 minute' } as const;

/**
 * 개발용 로그인만 따로 넉넉하게 둔다. 스모크 테스트가 한 번 돌 때마다 여러 명으로 로그인하고,
 * 이 라우트는 운영에 아예 존재하지 않기 때문에 조여봐야 지키는 게 없다.
 */
const DEV_LOGIN_LIMIT = { max: 100, timeWindow: '1 minute' } as const;

function encodeState(returnUrl: string): string {
  return Buffer.from(JSON.stringify({ returnUrl }), 'utf8').toString('base64url');
}

function decodeState(state: string): { returnUrl: string } {
  try {
    return JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
  } catch {
    throw badRequest('BAD_STATE', 'state 값이 올바르지 않습니다.');
  }
}

/** returnUrl 에 토큰을 붙인다. exp:// 같은 커스텀 스킴도 다뤄야 하므로 문자열로 처리한다. */
function appendToken(returnUrl: string, token: string): string {
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}token=${encodeURIComponent(token)}`;
}

export async function authRoutes(app: FastifyInstance) {
  /** 앱이 로그인 화면을 그리기 전에 어떤 수단이 열려 있는지 확인한다. */
  app.get('/auth/config', async () => ({
    kakao: kakaoConfigured,
    dev: env.devLogin,
  }));

  app.get(
    '/auth/kakao/start',
    { config: { rateLimit: SENSITIVE_LIMIT } },
    async (request, reply) => {
      if (!kakaoConfigured) {
        throw badRequest(
          'KAKAO_NOT_CONFIGURED',
          '서버에 카카오 REST API 키가 설정되지 않았습니다.',
        );
      }

      const { returnUrl } = z.object({ returnUrl: z.string().min(1) }).parse(request.query);

      const params = new URLSearchParams({
        client_id: env.kakao.restApiKey,
        redirect_uri: `${env.publicBaseUrl}${REDIRECT_PATH}`,
        response_type: 'code',
        state: encodeState(returnUrl),
      });

      return reply.redirect(`https://kauth.kakao.com/oauth/authorize?${params}`);
    },
  );

  app.get(
    '/auth/kakao/callback',
    { config: { rateLimit: SENSITIVE_LIMIT } },
    async (request, reply) => {
      const query = z
        .object({ code: z.string().optional(), state: z.string(), error: z.string().optional() })
        .parse(request.query);

      const { returnUrl } = decodeState(query.state);

      // 사용자가 동의 화면에서 취소한 경우
      if (query.error || !query.code) {
        const separator = returnUrl.includes('?') ? '&' : '?';
        return reply.redirect(
          `${returnUrl}${separator}error=${encodeURIComponent(query.error ?? 'cancelled')}`,
        );
      }

      const profile = await fetchKakaoProfile(query.code, `${env.publicBaseUrl}${REDIRECT_PATH}`);

      const user = await prisma.user.upsert({
        where: { kakaoId: profile.kakaoId },
        // 닉네임/프로필은 카카오가 원본이므로 로그인할 때마다 최신으로 맞춘다
        update: { nickname: profile.nickname, profileImageUrl: profile.profileImageUrl },
        create: {
          kakaoId: profile.kakaoId,
          nickname: profile.nickname,
          profileImageUrl: profile.profileImageUrl,
        },
      });

      return reply.redirect(appendToken(returnUrl, issueToken(user.id)));
    },
  );

  /**
   * 개발용 로그인. 카카오 앱 등록 없이 에뮬레이터에서 바로 여러 명을 만들어
   * 가족 초대/합류 시나리오를 돌려볼 수 있게 한다.
   *
   * ★ 꺼져 있으면 핸들러가 401 을 던지는 게 아니라 **라우트 자체를 안 붙인다.**
   *   이름만 알면 그 사람이 되는 라우트라서, 코드에 남아 있는 것만으로도 사고 경로가 된다.
   *   등록을 안 하면 잘못 배포해도 404 다. 안에도 검사를 하나 더 둔다 (두 겹).
   */
  if (env.devLogin) {
    app.post('/auth/dev', { config: { rateLimit: DEV_LOGIN_LIMIT } }, async (request) => {
      if (!env.devLogin) throw unauthorized('개발용 로그인이 꺼져 있습니다.');

      const { name } = z.object({ name: z.string().trim().min(1).max(20) }).parse(request.body);
      const devKey = `dev:${name}`;

      const user = await prisma.user.upsert({
        where: { devKey },
        update: {},
        create: { devKey, nickname: name },
      });

      return { token: issueToken(user.id) };
    });
  }

  app.get('/me', async (request) => {
    const user = await requireUser(request);

    const memberships = await prisma.membership.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { family: true },
      orderBy: { joinedAt: 'asc' },
    });

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
        isDev: user.devKey !== null,
      },
      memberships: memberships.map((m) => ({
        id: m.id,
        role: m.role,
        displayName: m.displayName,
        family: { id: m.family.id, name: m.family.name, inviteCode: m.family.inviteCode },
      })),
    };
  });
}
