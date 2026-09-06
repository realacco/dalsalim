#!/usr/bin/env node
/**
 * 리뷰 컨텍스트 조립 — 바뀐 파일에서 거꾸로 올라가 "무엇을 봐야 하는지"를 뽑는다.
 *
 *   바뀐 파일 → 파일 맨 위 `// 기능:` 주석 → 인덱스의 하드룰 축 → CLAUDE.md 하드룰 본문
 *
 * 이걸 에이전트가 매번 grep 으로 다시 하게 두지 않는 이유는 두 가지다.
 * 결정적이고(같은 PR 이면 같은 결과), 이 단계가 실패해도 리뷰는 그대로 돈다.
 *
 * 출력은 `.github/review-context.md` 한 장. 워크플로가 그 경로를 프롬프트에 알려준다.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { blockText, pageIdFrom } from './notion-text.mjs';

const INDEX = 'docs/04-기능-정의서-인덱스.md';
const OUT = '.github/review-context.md';
const BASE = process.env.BASE_SHA || 'origin/main';
const ID = /F-[A-Z]+-\d{2}/g;

const NOTION_VERSION = '2026-03-11';
/** 걸린 기능이 많으면 다 가져오지 않는다 — 그건 PR 이 큰 것이고, 그 사실 자체를 리뷰가 알아야 한다 */
const MAX_SPEC_PAGES = 5;
const MAX_SPEC_CHARS = 6000;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e8 }).trim();

/** 인덱스 한 행 → { id, url, title, hardrules } */
function indexRows() {
  if (!existsSync(INDEX)) return [];
  const text = readFileSync(INDEX, 'utf8');
  const re = /^\|\s*\[(F-[A-Z]+-\d{2})\]\(([^)]+)\)\s*\|([^|]*)\|([^|]*)\|/gm;
  return [...text.matchAll(re)].map((m) => ({
    id: m[1],
    url: m[2],
    title: m[3].trim(),
    hardrules: m[4].trim().replace(/\*/g, ''),
  }));
}

/**
 * CLAUDE.md 「도메인 하드룰」의 번호 항목 1~9 본문.
 *
 * 정규식 대신 줄 단위로 모으는 이유: 항목이 여러 줄이고 들여쓴 하위 항목까지 딸려 있는데,
 * `m` 플래그를 쓰면 `$` 가 줄 끝에 걸려 첫 줄에서 끊긴다 (실제로 그렇게 잘렸다).
 */
function hardruleBodies() {
  const section = /## 도메인 하드룰[\s\S]*?(?=\n## )/.exec(readFileSync('CLAUDE.md', 'utf8'));
  if (!section) return new Map();

  const items = new Map();
  let current = null;
  // ⚠️ `\r?\n` 으로 나눈다. 이 저장소는 워킹트리가 CRLF 라 `\n` 으로만 나누면 줄 끝에 `\r` 이
  //    남고, `(.*)$` 가 `\r` 을 못 먹어서 매치가 통째로 실패한다 (실제로 두 번 데였다)
  for (const line of section[0].split(/\r?\n/)) {
    const start = /^(\d)\. (.*)$/.exec(line);
    if (start) {
      current = start[1];
      items.set(current, start[2]);
    } else if (current && (line.startsWith('   ') || line.startsWith('  -'))) {
      items.set(current, `${items.get(current)}\n${line}`);
    } else if (current && line.trim() === '') {
      // 항목 사이 빈 줄에서 끊지 않는다 — 아래에 이어지는 하위 항목이 있다
    } else {
      current = null;
    }
  }
  return items;
}

/**
 * Notion 기능 정의서 본문 — 리뷰가 "명세대로 만들었나" 를 볼 수 있게 하는 유일한 재료다.
 *
 * 토큰이 없거나 실패하면 **조용히 건너뛴다.** 리뷰는 차단이 아니라 코멘트라서,
 * 못 읽으면 그 축만 빠지고 나머지는 그대로 돈다 — 커밋을 막는 검사였다면 이렇게 못 한다.
 */
async function notionBlocks(pageId, token, depth = 0) {
  if (depth > 1) return []; // 표(table → table_row)까지가 두 단계다. 더 파고들 이유가 없다
  const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`, {
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const { results = [] } = await res.json();

  const lines = [];
  for (const block of results) {
    const text = blockText(block);
    if (text) lines.push(text);
    if (block.has_children) lines.push(...(await notionBlocks(block.id, token, depth + 1)));
  }
  return lines;
}

async function fetchSpecs(features) {
  const token = process.env.NOTION_TOKEN;
  if (!token) return { skipped: '토큰이 없어요 (NOTION_TOKEN)' };
  if (features.length > MAX_SPEC_PAGES) {
    return {
      skipped: `걸린 기능이 ${features.length}개예요. ${MAX_SPEC_PAGES}개 이하일 때만 가져와요 — PR 이 크다는 뜻이기도 해요`,
    };
  }

  const specs = [];
  for (const f of features) {
    const id = pageIdFrom(f.url);
    if (!id) continue;
    try {
      const body = (await notionBlocks(id, token)).join('\n');
      specs.push({ ...f, body: body.slice(0, MAX_SPEC_CHARS) });
    } catch (error) {
      specs.push({ ...f, error: String(error.message ?? error) });
    }
  }
  return { specs };
}

const changed = git('diff', '--name-only', `${BASE}...HEAD`).split('\n').filter(Boolean);

const sources = changed.filter((f) => /\.(tsx?|mjs)$/.test(f) && existsSync(f));
const ids = new Set();
const byFile = new Map();

/**
 * 파일이 어느 기능을 떠받치는지 알아내는 두 가지 길.
 *
 * 소스는 맨 위 `// 기능:` 주석 한 줄이지만, **테스트는 케이스 이름에 ID 를 적는다**
 * (`★ F-ENT-04 금액이 달라지면 …`). 주석만 보면 테스트만 바꾼 PR 에서 컨텍스트가
 * 통째로 비고, 리뷰어가 맨땅에서 탐색하다 턴을 다 쓴다 — PR #6 에서 실제로 그랬다.
 */
function idsIn(file) {
  const text = readFileSync(file, 'utf8');
  const isTest = /\.test\.(tsx?|mjs)$|smoke\.mjs$/.test(file);
  if (isTest) return [...new Set(text.match(ID) ?? [])];

  // trim 이 지우는 건 공백이 아니라 CRLF 의 `\r` 이다 — JS 의 `.` 은 `\r` 을 안 먹는다
  const first = (text.split('\n', 1)[0] ?? '').trim();
  return first.startsWith('// 기능:') ? (first.match(ID) ?? []) : [];
}

for (const file of sources) {
  const found = idsIn(file);
  if (found.length === 0) continue;
  byFile.set(file, found);
  for (const id of found) ids.add(id);
}

const rows = indexRows();
const hit = [...ids]
  .sort()
  .map(
    (id) =>
      rows.find((r) => r.id === id) ?? { id, title: '(인덱스에 없음)', hardrules: '', url: '' },
  );
const rules = new Set(
  hit.flatMap((r) => (r.hardrules.match(/H(\d)/g) ?? []).map((h) => h.slice(1))),
);
const bodies = hardruleBodies();

const out = [];
out.push('# 이 PR 에서 봐야 할 것\n');
out.push(`브랜치 \`${git('rev-parse', '--abbrev-ref', 'HEAD')}\` · 파일 ${changed.length}개\n`);
// 리뷰어가 diff 를 뜰 ref 를 직접 준다. 짐작하게 두면 base 를 잘못 잡아 남의 커밋까지 지적한다
out.push(`바뀐 줄은 이 범위로 본다 — \`git diff ${BASE}...HEAD\`\n`);

if (hit.length) {
  out.push('## 걸린 기능\n');
  out.push('| 기능 | 하드룰 | 파일 |');
  out.push('|---|---|---|');
  for (const r of hit) {
    const files = [...byFile.entries()]
      .filter(([, v]) => v.includes(r.id))
      .map(([f]) => `\`${f}\``);
    out.push(`| ${r.id} ${r.title} | ${r.hardrules || '—'} | ${files.join(' ') || '—'} |`);
  }
  out.push('');
} else {
  out.push(
    '## 걸린 기능\n\n바뀐 파일에 `// 기능:` 주석이 없다. 기능 축으로는 볼 것이 없고, 아래 「프로젝트 규칙」만 본다.\n',
  );
}

if (rules.size) {
  out.push('## 이 PR 이 건드리는 하드룰 — 최우선 검토 축\n');
  out.push('**어기면 제품이 아니라 다른 앱이 된다.** 아래 항목은 CLAUDE.md 원문 그대로다.\n');
  for (const n of [...rules].sort()) {
    const body = bodies.get(n);
    if (body) out.push(`${n}. ${body}\n`);
  }
}

const { specs, skipped } = await fetchSpecs(hit);

if (specs?.length) {
  out.push('## 기능 정의서 본문 (Notion)\n');
  out.push(
    '**이 PR 의 코드가 아래 명세대로 도는지 본다.** 코드가 명세와 다르면 그것이 지적 대상이다.\n',
  );
  for (const s of specs) {
    out.push(`### ${s.id} ${s.title}\n`);
    if (s.error) out.push(`_읽지 못했어요: ${s.error}_\n`);
    else out.push(`${s.body}\n`);
  }
} else if (skipped) {
  out.push('## 기능 정의서 본문 (Notion)\n');
  out.push(
    `_가져오지 않았어요 — ${skipped}._ 명세와 코드가 맞는지는 이번 리뷰가 볼 수 없다.\n` +
      '어긋난 것 같아도 **"확인 필요"로만 적고 단정하지 않는다.**\n',
  );
}

const commits = git(
  'log',
  '--format=%s%x09%(trailers:key=Feature,valueonly,separator=%x2C)',
  `${BASE}..HEAD`,
)
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [subject, trailer] = line.split('\t');
    return trailer?.trim() ? `${subject}   [${trailer.trim()}]` : subject;
  });

out.push(`## 커밋 ${commits.length}개\n`);
out.push('```');
out.push(commits.join('\n') || '(없음)');
out.push('```\n');

out.push('## 바뀐 파일\n');
out.push('```');
out.push(changed.join('\n'));
out.push('```');

writeFileSync(OUT, out.join('\n') + '\n', 'utf8');
console.log(`${OUT} — 기능 ${hit.length}개 · 하드룰 ${rules.size}개 · 파일 ${changed.length}개`);
