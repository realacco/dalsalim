#!/usr/bin/env node
/**
 * 스테이징된 변경에서 **밖에 나가면 안 되는 것**을 찾는다. pre-commit 에서 돈다.
 *
 * 왜 있나: 저장소가 PUBLIC 이 됐다. .gitignore 는 실수로 `git add -f` 한 것을 막지 못하고,
 * 한 번 push 된 비밀은 히스토리를 다시 쓰기 전까지 남는다. 커밋 **전에** 막는 게 유일하게 싸다.
 *
 * 무엇을 보나
 *   1) 파일 이름 — `.env` · `data-export*.json` · 키/인증서 파일
 *   2) **이번에 추가된 줄** — 토큰 · 개인키 · 자격증명이 든 접속 문자열
 *
 * 이미 있던 줄은 보지 않는다. 문서에 적힌 `JWT_SECRET` 같은 설명글까지 걸리면
 * 곧 아무도 안 쓰게 된다 — 오탐 한 번이 도구를 죽인다.
 *
 * 빠져나가는 법 (정말 필요할 때만)
 *   - 그 줄 끝에 `secret-scan:allow` 를 적는다
 *   - 또는 `SKIP_SECRET_SCAN=1 git commit ...`
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** 이 파일 자신은 검사 대상이 아니다 — 패턴 문자열이 그대로 들어 있다 */
const SELF = 'scripts/scan-secrets.mjs';

/** 값이 이것 중 하나면 진짜 비밀이 아니라 자리표시자다 */
const PLACEHOLDER =
  /(change[-_ ]?me|your[-_ ]|example|placeholder|dummy|sample|test|xxx|<[^>]*>|\.\.\.|여기|dev-secret|postgres:postgres@localhost)/i;

const PATH_RULES = [
  {
    test: (p) => /(^|\/)\.env(\.[^/]*)?$/.test(p) && !/\.example$/.test(p),
    why: '환경변수 파일이다. server/.env.example 만 커밋한다',
  },
  {
    test: (p) => /(^|\/)data-export.*\.json$/.test(p),
    why: '실제 가계 내용이 들어 있는 내보내기 파일이다 (CLAUDE.md 보안 규칙)',
  },
  {
    test: (p) => /\.(pem|p12|pfx|p8|key|keystore|jks)$/i.test(p),
    why: '개인키 · 인증서 · 서명 키스토어다',
  },
  {
    test: (p) =>
      /(^|\/)(google-services\.json|GoogleService-Info\.plist|serviceAccount.*\.json)$/.test(p),
    why: '서비스 계정 자격증명이다',
  },
];

const CONTENT_RULES = [
  {
    name: '개인키',
    re: /-----BEGIN(?: [A-Z]+)* PRIVATE KEY-----/,
  },
  {
    name: 'AWS 액세스 키',
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: 'GitHub 토큰',
    re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  },
  {
    name: 'Slack 토큰',
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
  },
  {
    name: 'Google API 키',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
  },
  {
    name: '발급된 JWT',
    re: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/,
  },
  {
    name: '자격증명이 든 DB 접속 문자열',
    // 로컬(localhost·127.0.0.1)이나 자리표시자 비밀번호는 통과시킨다
    re: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:@\s"'`]+:([^@\s"'`]+)@([^\s"'`/:]+)/,
    ok: (m) => PLACEHOLDER.test(m[1]) || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|<.*>)$/.test(m[2]),
  },
  {
    name: '비밀 값 대입 (따옴표 안의 리터럴)',
    // 따옴표에 싸인 값만 본다. `const token = req.headers.authorization` 같은
    // 코드 표현식까지 잡으면 오탐이 쏟아지고 도구가 죽는다
    re: /[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY)[A-Za-z0-9_]*\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/i,
    ok: (m) => PLACEHOLDER.test(m[1]) || /[.(){}$]/.test(m[1]),
  },
  {
    name: '비밀 값 대입 (.env 형식)',
    re: /^\s*[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY)[A-Za-z0-9_]*\s*=\s*([^"'`\s]{12,})\s*$/i,
    ok: (m) => PLACEHOLDER.test(m[1]) || /[.(){}$]/.test(m[1]),
  },
];

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/** 스테이징된 파일 이름을 본다 */
function scanPaths() {
  const files = git('diff', '--cached', '--name-only', '--diff-filter=ACM')
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  const found = [];
  for (const file of files) {
    const base = path.posix.normalize(file);
    for (const rule of PATH_RULES) {
      if (rule.test(base))
        found.push({ file: base, line: null, what: '커밋하면 안 되는 파일', why: rule.why });
    }
  }
  return found;
}

/** 이번에 추가된 줄만 본다 */
function scanAddedLines() {
  const diff = git('diff', '--cached', '-U0', '--no-color', '--diff-filter=ACM');
  const found = [];
  let file = null;
  let lineNo = 0;

  for (const raw of diff.split('\n')) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '').trim();
      continue;
    }
    if (raw.startsWith('@@')) {
      const m = raw.match(/\+(\d+)/);
      lineNo = m ? Number(m[1]) : 0;
      continue;
    }
    if (!raw.startsWith('+') || raw.startsWith('+++')) continue;

    const text = raw.slice(1);
    const at = lineNo++;
    if (!file || file === '/dev/null' || file === SELF) continue;
    if (text.includes('secret-scan:allow')) continue;

    for (const rule of CONTENT_RULES) {
      const m = text.match(rule.re);
      if (!m) continue;
      if (rule.ok && rule.ok(m)) continue;
      found.push({ file, line: at, what: rule.name, why: text.trim().slice(0, 80) });
    }
  }
  return found;
}

/** 규칙이 실제로 무엇을 잡고 무엇을 놓아주는지 — 러너 없이 확인하는 최소 장치 */
function selfTest() {
  const cases = [
    ['JWT_SECRET="dalsalim-dev-secret-change-me"', false],
    ['DATABASE_URL="postgresql://postgres:postgres@localhost:5432/dalsalim"', false],
    ['KAKAO_REST_API_KEY=""', false],
    ['| `JWT_SECRET` | `openssl rand -base64 32` 로 만든 값 |', false],
    ['└▶ 302 exp://...?token=eyJ...', false],
    ['#   postgresql://<user>:<password>@<host>:<port>/<db>', false],
    ['const token = req.headers.authorization;', false],
    ['JWT_SECRET="8Jq2vXn4pLd7RtYw0ZbC1aEfG5hK9mNs"', true],
    ['KAKAO_REST_API_KEY=0a1b2c3d4e5f60718293a4b5c6d7e8f9', true],
    ['DATABASE_URL="postgresql://dal:S3cretPw@containers.railway.app:5432/railway"', true],
    ['-----BEGIN RSA PRIVATE KEY-----', true],
    ['aws_key = AKIAIOSFODNN7EXAMPLE', true],
    ['ghp_1234567890abcdefghijklmnopqrstuvwxyz', true],
    [
      'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N',
      true,
    ],
    ['JWT_SECRET="8Jq2vXn4pLd7RtYw0ZbC1aEfG5hK9mNs" // secret-scan:allow', false],
  ];

  let failed = 0;
  for (const [text, shouldFlag] of cases) {
    if (text.includes('secret-scan:allow')) {
      if (shouldFlag) failed++;
      continue;
    }
    const hit = CONTENT_RULES.some((rule) => {
      const m = text.match(rule.re);
      return m && !(rule.ok && rule.ok(m));
    });
    if (hit !== shouldFlag) {
      failed++;
      console.error(`  ✗ ${shouldFlag ? '잡아야 하는데 놓쳤다' : '오탐'}: ${text}`);
    }
  }

  const paths = [
    ['server/.env', true],
    ['server/.env.example', false],
    ['server/data-export.json', true],
    ['docs/01-MVP-기획서.md', false],
    ['mobile/android/app/release.keystore', true],
  ];
  for (const [p, shouldFlag] of paths) {
    const hit = PATH_RULES.some((r) => r.test(p));
    if (hit !== shouldFlag) {
      failed++;
      console.error(`  ✗ 경로 판정 틀림(${shouldFlag ? '막아야 함' : '통과해야 함'}): ${p}`);
    }
  }

  if (failed) {
    console.error(`\n비밀 스캔 자체 점검 실패 ${failed}건`);
    process.exit(1);
  }
  console.log(`비밀 스캔 자체 점검 통과 (${cases.length + paths.length}건)`);
}

function main() {
  if (process.argv.includes('--selftest')) return selfTest();

  if (process.env.SKIP_SECRET_SCAN === '1') {
    console.warn('⚠ 비밀 스캔을 건너뛴다 (SKIP_SECRET_SCAN=1)');
    return;
  }

  const found = [...scanPaths(), ...scanAddedLines()];
  if (found.length === 0) return;

  console.error('\n🔴 커밋을 멈춘다 — 밖에 나가면 안 되는 것이 들어 있다.\n');
  for (const f of found) {
    console.error(`  ${f.file}${f.line ? `:${f.line}` : ''}  ${f.what}`);
    console.error(`    ${f.why}\n`);
  }
  console.error('  자리표시자인데 걸렸다면 그 줄 끝에 secret-scan:allow 를 적는다.');
  console.error(
    '  정말 넘겨야 하면 SKIP_SECRET_SCAN=1 git commit ... — 대신 왜 넘겼는지 본문에 남긴다.\n',
  );
  process.exit(1);
}

main();
