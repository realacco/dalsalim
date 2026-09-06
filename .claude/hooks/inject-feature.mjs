#!/usr/bin/env node
/**
 * 주입 — 고치려는 파일이 어느 기능을 떠받치는지 눈앞에 놓는다.
 *
 * **막지 않는다.** "스펙을 봤는지"는 기계가 판정할 수 없어서, 검사하는 대신
 * 안 볼 수 없게 보여주는 쪽을 택했다. 차단은 관문 훅 하나로 충분하다.
 *
 * 파일 맨 위 `// 기능:` 주석을 먼저 읽는다 — 파일과 한 몸이라 늘 최신이다.
 * 주석이 없으면(새 파일 등) 인덱스에서 경로로 찾는다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const INDEX = 'docs/04-기능-정의서-인덱스.md';
const ID = /F-[A-Z]+-\d{2}/g;

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/** 인덱스 한 행 → { id, title, hardrules, url } */
function indexRows(root) {
  const text = readFileSync(path.join(root, INDEX), 'utf8');
  return [
    ...text.matchAll(
      /^\|\s*\[(F-[A-Z]+-\d{2})\]\(([^)]+)\)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|/gm,
    ),
  ].map((m) => ({
    id: m[1],
    url: m[2],
    title: m[3].trim(),
    hardrules: m[4].trim().replace(/\*/g, ''),
    paths: `${m[5]} ${m[6]}`,
  }));
}

/** 파일 맨 위 주석. CRLF 의 `\r` 때문에 trim 이 필요하다 — JS 의 `.` 은 `\r` 을 안 먹는다 */
function idsFromComment(absolute) {
  if (!existsSync(absolute)) return [];
  const first = (readFileSync(absolute, 'utf8').split('\n', 1)[0] ?? '').trim();
  return first.startsWith('// 기능:') ? (first.match(ID) ?? []) : [];
}

/** 주석이 없을 때만. `server/src/routes/auth.ts` → 인덱스 표기 `routes/auth.ts` */
function idsFromIndexPath(rows, relative) {
  const short = relative.replace(/^(server|mobile)\/src\//, '').replace(/^server\//, '');
  if (short.length < 4) return [];
  return rows.filter((row) => row.paths.includes(short)).map((row) => row.id);
}

function main(input) {
  const filePath = input?.tool_input?.file_path;
  if (!filePath) return;

  const root = repoRoot();
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
  const relative = path.relative(root, absolute).replaceAll('\\', '/');
  if (relative.startsWith('..')) return;

  const rows = indexRows(root);
  const ids = idsFromComment(absolute);
  const found = ids.length > 0 ? ids : idsFromIndexPath(rows, relative);
  if (found.length === 0) return;

  const lines = [...new Set(found)].map((id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return `  ${id} — 인덱스에 없어요. 오타이거나 인덱스에 행이 빠졌어요`;
    const rules = row.hardrules && row.hardrules !== '—' ? ` · 하드룰 ${row.hardrules}` : '';
    return `  ${id} ${row.title}${rules}\n    ${row.url}`;
  });

  process.stdout.write(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext:
          `${relative} 는 아래 기능을 떠받쳐요. 동작을 바꾸기 전에 기능 정의서를 확인하세요.\n` +
          `${lines.join('\n')}\n` +
          `하드룰이 걸려 있으면 CLAUDE.md 「도메인 하드룰」을 같이 읽고, 테스트 케이스를 추가해야 완료예요.`,
      },
    }),
  );
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  try {
    main(JSON.parse(raw || '{}'));
  } catch {
    /* 알림용 훅이 작업을 막아서는 안 된다 */
  }
});
