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
 *
 * 규칙이 무엇을 잡고 무엇을 놓아주는지는 tests/tools/scan-secrets.test.mjs 가 지킨다.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 검사하지 않는 파일 — 이 스크립트 자신과 그 테스트.
 * 둘 다 "잡아야 하는 문자열"을 본문에 그대로 들고 있어야 하는 파일이다.
 */
const FIXTURE_FILES = new Set(['scripts/scan-secrets.mjs', 'tests/tools/scan-secrets.test.mjs']);

/** 값이 이것 중 하나면 진짜 비밀이 아니라 자리표시자다 */
export const PLACEHOLDER =
  /(change[-_ ]?me|your[-_ ]|example|placeholder|dummy|sample|test|xxx|<[^>]*>|\.\.\.|여기|dev-secret|postgres:postgres@localhost)/i;

export const PATH_RULES = [
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

export const CONTENT_RULES = [
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

/** 이 경로를 커밋하면 안 되는 이유. 괜찮으면 null */
export function blockedPath(filePath) {
  const rule = PATH_RULES.find((r) => r.test(filePath));
  return rule ? rule.why : null;
}

/** 이 줄에서 걸리는 규칙 이름. 괜찮으면 null */
export function matchSecret(text) {
  if (text.includes('secret-scan:allow')) return null;
  for (const rule of CONTENT_RULES) {
    const m = text.match(rule.re);
    if (!m) continue;
    if (rule.ok && rule.ok(m)) continue;
    return rule.name;
  }
  return null;
}

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
    if (!file || file === '/dev/null' || FIXTURE_FILES.has(file)) continue;

    const what = matchSecret(text);
    if (what) found.push({ file, line: at, what, why: text.trim().slice(0, 80) });
  }
  return found;
}

function main() {
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
