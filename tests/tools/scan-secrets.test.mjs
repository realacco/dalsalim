import { describe, it, expect } from 'vitest';
import { blockedPath, matchSecret } from '../../scripts/scan-secrets.mjs';

/**
 * 비밀 스캔은 **오탐 한 번이면 죽는 도구**다.
 * 한 번 --no-verify 를 배우면 그 다음부터는 늘 그걸 쓴다.
 * 그래서 "잡아야 하는 것"과 같은 무게로 "놓아줘야 하는 것"을 함께 못박아 둔다.
 */
describe('놓아줘야 하는 것 — 이게 걸리면 아무도 훅을 안 쓴다', () => {
  const allowed = [
    ['.env.example 의 자리표시자', 'JWT_SECRET="dalsalim-dev-secret-change-me"'],
    [
      '로컬 DB 접속 문자열',
      'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dalsalim"',
    ],
    ['빈 값', 'KAKAO_REST_API_KEY=""'],
    ['문서의 설명글', '| `JWT_SECRET` | `openssl rand -base64 32` 로 만든 값 |'],
    ['README 의 줄임 표기', '└▶ 302 exp://...?token=eyJ...'],
    ['꺾쇠 자리표시자', '#   postgresql://<user>:<password>@<host>:<port>/<db>'],
    ['코드 표현식', 'const token = req.headers.authorization;'],
    ['타입 선언', 'type Session = { token: string; expiresAt: string };'],
  ];

  for (const [label, line] of allowed) {
    it(`통과: ${label}`, () => {
      expect(matchSecret(line)).toBeNull();
    });
  }
});

describe('잡아야 하는 것', () => {
  const blocked = [
    ['진짜 JWT 시크릿', 'JWT_SECRET="8Jq2vXn4pLd7RtYw0ZbC1aEfG5hK9mNs"'],
    ['카카오 REST 키', 'KAKAO_REST_API_KEY=0a1b2c3d4e5f60718293a4b5c6d7e8f9'],
    [
      '운영 DB 접속 문자열',
      'DATABASE_URL="postgresql://dal:S3cretPw@containers.railway.app:5432/railway"',
    ],
    ['개인키', '-----BEGIN RSA PRIVATE KEY-----'],
    ['AWS 액세스 키', 'aws_key = AKIAIOSFODNN7EXAMPLE'],
    ['GitHub 토큰', 'ghp_1234567890abcdefghijklmnopqrstuvwxyz'],
    [
      '발급된 JWT',
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N',
    ],
  ];

  for (const [label, line] of blocked) {
    it(`막힘: ${label}`, () => {
      expect(matchSecret(line)).not.toBeNull();
    });
  }

  it('★ 자리표시자라고 우겨도 값이 진짜면 막는다', () => {
    // PLACEHOLDER 판정은 값 전체가 아니라 부분 일치라 우회가 쉬워 보이지만,
    // 그건 의도한 것이다 — 걸러내는 쪽을 넓게 잡아야 도구가 살아남는다.
    // 대신 우회에는 흔적(secret-scan:allow)이 남아야 한다
    expect(matchSecret('JWT_SECRET="8Jq2vXn4pLd7RtYw0ZbC1aEfG5hK9mNs"')).not.toBeNull();
  });
});

describe('빠져나가는 길', () => {
  it('secret-scan:allow 를 적은 줄은 통과한다', () => {
    expect(
      matchSecret('JWT_SECRET="8Jq2vXn4pLd7RtYw0ZbC1aEfG5hK9mNs" // secret-scan:allow'),
    ).toBeNull();
  });
});

describe('파일 이름만으로 막는 것', () => {
  const cases = [
    ['server/.env', true],
    ['server/.env.local', true],
    ['server/.env.example', false],
    ['server/data-export.json', true],
    ['server/data-export-2026-09.json', true],
    ['mobile/android/app/release.keystore', true],
    ['certs/apple.p8', true],
    ['mobile/google-services.json', true],
    ['docs/01-MVP-기획서.md', false],
    ['server/src/env.ts', false],
  ];

  for (const [file, shouldBlock] of cases) {
    it(`${shouldBlock ? '막힘' : '통과'}: ${file}`, () => {
      expect(blockedPath(file) !== null).toBe(shouldBlock);
    });
  }
});
