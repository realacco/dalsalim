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
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',

  /** 앱이 서버를 부르는 주소. 카카오 redirect_uri 를 만들 때 쓴다. */
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,

  jwtSecret: process.env.JWT_SECRET ?? 'dalsalim-dev-secret-change-me',

  kakao: {
    restApiKey: process.env.KAKAO_REST_API_KEY ?? '',
    clientSecret: process.env.KAKAO_CLIENT_SECRET ?? '',
  },

  /**
   * 카카오 앱 키 없이도 에뮬레이터에서 바로 테스트할 수 있게 하는 개발용 로그인.
   * 운영에서는 반드시 false.
   */
  devLogin: (process.env.DEV_LOGIN ?? 'true') === 'true',
} as const;

export const kakaoConfigured = env.kakao.restApiKey.length > 0;
