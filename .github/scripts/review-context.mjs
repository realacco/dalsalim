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

const INDEX = 'docs/04-기능-정의서-인덱스.md';
const OUT = '.github/review-context.md';
const BASE = process.env.BASE_SHA || 'origin/main';
const ID = /F-[A-Z]+-\d{2}/g;

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

const changed = git('diff', '--name-only', `${BASE}...HEAD`).split('\n').filter(Boolean);

const sources = changed.filter((f) => /\.tsx?$/.test(f) && existsSync(f));
const ids = new Set();
const byFile = new Map();

for (const file of sources) {
  // trim 이 지우는 건 공백이 아니라 CRLF 의 `\r` 이다 — JS 의 `.` 은 `\r` 을 안 먹는다
  const first = (readFileSync(file, 'utf8').split('\n', 1)[0] ?? '').trim();
  if (!first.startsWith('// 기능:')) continue;
  const found = first.match(ID) ?? [];
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
