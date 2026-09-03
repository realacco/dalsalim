import fs from 'node:fs';
import path from 'node:path';

/** .env 를 읽어 process.env 에 채운다 (의존성 없이 최소 구현) */
function loadDotEnv() {
  const file = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(file)) return;

  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const DEFAULT_JWT_SECRET = 'dalsalim-dev-secret-change-me';

const isProduction = process.env.NODE_ENV === 'production';

export const env = {
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',

  /** 앱이 서버를 부르는 주소. 카카오 redirect_uri 를 만들 때 쓴다. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

  jwtSecret: process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET,

  kakao: {
    restApiKey: process.env.KAKAO_REST_API_KEY ?? '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
  },

  /**
   * 카카오 앱 키 없이도 에뮬레이터에서 바로 여러 명을 만들어볼 수 있게 하는 개발용 로그인.
   *
   * ★ 기본값이 꺼짐이다. 이름만 알면 그 사람이 되는 라우트라서,
   *   환경변수를 빼먹고 배포했을 때 켜져 있으면 안 된다.
   *   개발 편의는 server/.env.example 의 DEV_LOGIN=true 로 챙긴다.
   *   운영에서는 아예 켤 수 없다 — 아래에서 막는다.
   */
  devLogin: !isProduction && process.env.DEV_LOGIN === 'true',
} as const;

export const kakaoConfigured = env.kakao.restApiKey.length > 0;

/**
 * 운영에서 기본 시크릿으로 뜨면 아무 사용자로도 토큰을 위조할 수 있다.
 * 조용히 도는 것보다 안 뜨는 게 낫다.
 */
if (isProduction && env.jwtSecret === DEFAULT_JWT_SECRET) {
  throw new Error(
    'JWT_SECRET 이 기본값입니다. 운영에서는 반드시 바꿔야 합니다. (openssl rand -base64 32)',
  );
}
