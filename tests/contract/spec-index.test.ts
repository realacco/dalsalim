import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * ★ `docs/04-기능-정의서-인덱스.md` 와 코드의 `// 기능:` 주석이 진짜 같은지 본다.
 *
 * 같은 사실이 두 곳에 적혀 있고, 어긋나도 **아무 일도 일어나지 않는 것**이 문제였다.
 * `services/book.ts` 를 옮기면 인덱스는 없는 파일을 가리키는데, 검사가 없으니
 * `grep` 이 조용히 0건을 뱉고 사람은 "이 기능은 코드가 없나 보다"로 읽는다.
 * **틀린 값이 아니라 빈 결과로 나타나는 것**이라 영영 안 들킨다 —
 * 앱에서 "빈 화면을 남기지 않는다"고 정한 것과 같은 함정이다.
 *
 * Notion 을 부르지 않는다. 비교하는 두 벌이 **둘 다 저장소 안에 있다.**
 * (Notion ↔ 인덱스 는 여기서 못 잡는다. 다만 그 기능을 구현하는 순간 주석이 생기고,
 *  그때 인덱스에 없으면 아래 두 번째 케이스가 잡는다.)
 */

const ROOT = path.resolve(import.meta.dirname, '../..');
const INDEX = 'docs/04-기능-정의서-인덱스.md';
const SOURCE_DIRS = ['server/src', 'mobile/src'];

type Row = {
  id: string;
  line: number;
  /** 이름 칸의 ⬜ 가 미구현 표시다. 예외 목록을 코드에 박으면 그 목록이 또 낡는다 */
  done: boolean;
  server: string[];
  app: string[];
};

/** 백틱 토큰 중 경로인 것만. `refreshBookStatus` 같은 함수명은 같은 칸에 있어도 경로가 아니다 */
function pathsIn(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1])
    .filter((token) => token.includes('/') || /\.tsx?$/.test(token));
}

/** 마이그레이션만 `src/` 밖에 산다 */
function rootFor(column: 'server' | 'app', p: string): string {
  if (column === 'app') return 'mobile/src';
  return p.startsWith('prisma/') ? 'server' : 'server/src';
}

/** 인덱스는 확장자를 생략하기도 하고(`screens/gate`) 폴더를 가리키기도 한다(`shared/lib`) */
function resolves(column: 'server' | 'app', p: string): boolean {
  const base = path.join(ROOT, rootFor(column, p), p);
  return existsSync(base) || existsSync(`${base}.ts`) || existsSync(`${base}.tsx`);
}

function readIndex(): Row[] {
  const text = readFileSync(path.join(ROOT, INDEX), 'utf8');
  return text.split('\n').flatMap((raw, i) => {
    const matched = /^\|\s*\[(F-[A-Z]+-\d{2})\]/.exec(raw);
    if (!matched) return [];
    // | ID | 이름 | 하드룰 | 서버 | 앱 |
    const cells = raw.split('|').map((cell) => cell.trim());
    return [
      {
        id: matched[1],
        line: i + 1,
        done: !cells[2].includes('⬜'),
        server: pathsIn(cells[4] ?? ''),
        app: pathsIn(cells[5] ?? ''),
      },
    ];
  });
}

function readComments(): { byId: Map<string, string[]>; files: number } {
  const found = new Map<string, string[]>();
  let files = 0;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name)) continue;

      // ⚠️ trim 이 지우는 건 공백이 아니라 CRLF 의 `\r` 이다.
      // JS 의 `.` 은 `\r` 을 줄바꿈으로 보고 안 먹어서, 이게 없으면 CRLF 파일이 통째로 안 잡힌다.
      // 앱 파일이 CRLF 라 mobile/ 이 전부 투명해졌었다 (실제로 데임)
      const firstLine = (readFileSync(full, 'utf8').split('\n', 1)[0] ?? '').trim();
      const banner = /^\/\/ 기능:\s*(.+)$/.exec(firstLine);
      if (!banner) continue;

      files += 1;
      for (const id of banner[1].match(/F-[A-Z]+-\d{2}/g) ?? []) {
        const where = path.relative(ROOT, full).replaceAll('\\', '/');
        found.set(id, [...(found.get(id) ?? []), where]);
      }
    }
  };

  for (const dir of SOURCE_DIRS) walk(path.join(ROOT, dir));
  return { byId: found, files };
}

const rows = readIndex();
const { byId: comments, files: bannerFiles } = readComments();

describe('기능 정의서 인덱스 — 코드와 갈라지지 않는다', () => {
  it('인덱스와 주석을 실제로 읽었다 (파싱이 조용히 비지 않는다)', () => {
    // 표 형식이 바뀌어 파서가 0건을 뱉으면 아래 케이스가 전부 통과해버린다.
    // 검사가 사라진 것을 검사가 통과한 것으로 읽지 않기 위한 바닥이다
    expect(rows.length).toBeGreaterThanOrEqual(30);
    expect(comments.size).toBeGreaterThanOrEqual(20);
    // 파일 수까지 세는 이유: 한 기능이 서버·앱 양쪽에 있으면 한쪽이 통째로 안 잡혀도
    // ID 집합은 멀쩡해 보인다. CRLF 버그가 정확히 그렇게 숨었다
    expect(bannerFiles).toBeGreaterThanOrEqual(25);
  });

  it('★ 인덱스가 가리키는 코드 경로가 전부 실제로 있다', () => {
    const missing = rows.flatMap((row) => [
      ...row.server
        .filter((p) => !resolves('server', p))
        .map((p) => `${INDEX}:${row.line}  ${row.id}  서버 \`${p}\``),
      ...row.app
        .filter((p) => !resolves('app', p))
        .map((p) => `${INDEX}:${row.line}  ${row.id}  앱 \`${p}\``),
    ]);

    expect(
      missing,
      `인덱스가 없는 파일을 가리킨다:\n${missing.join('\n')}\n→ 파일을 옮겼으면 그 줄을 같이 고친다`,
    ).toEqual([]);
  });

  it('★ 인덱스에 구현으로 적힌 기능은 코드에 `// 기능:` 주석이 있다', () => {
    const orphans = rows
      .filter((row) => row.done && !comments.has(row.id))
      .map((row) => `${INDEX}:${row.line}  ${row.id}`);

    expect(
      orphans,
      `인덱스에는 있는데 코드 주석이 없다:\n${orphans.join('\n')}\n→ 아직 안 만들었으면 이름 칸에 ⬜ 를 붙인다`,
    ).toEqual([]);
  });

  it('★ 코드 주석의 기능 ID 는 전부 인덱스에 있다', () => {
    const known = new Set(rows.map((row) => row.id));
    const unknown = [...comments.entries()]
      .filter(([id]) => !known.has(id))
      .map(([id, files]) => `${id}  ← ${files.join(' ')}`);

    expect(
      unknown,
      `인덱스에 없는 기능 ID 가 주석에 있다:\n${unknown.join('\n')}\n→ 오타이거나, 인덱스에 행을 안 넣었다`,
    ).toEqual([]);
  });

  it('⬜ 미구현으로 적힌 기능은 코드에 없다', () => {
    const early = rows
      .filter((row) => !row.done && comments.has(row.id))
      .map((row) => `${row.id}  ← ${comments.get(row.id)?.join(' ')}`);

    expect(
      early,
      `⬜ 로 적혀 있는데 코드에 이미 있다:\n${early.join('\n')}\n→ 만들었으면 인덱스의 ⬜ 를 지운다`,
    ).toEqual([]);
  });
});
