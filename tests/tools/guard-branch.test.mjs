import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { committable, inside, isIgnored, realPath } from '../../.claude/hooks/guard-branch.mjs';

/**
 * 관문 훅이 `main` 에서 무엇을 막고 무엇을 놓아주는지의 판정.
 *
 * 🔴 **놓아주는 쪽을 같은 무게로 못박아 둔다.** 안 막는 훅은 아무 흔적을 안 남겨서,
 * 조용히 꺼져도 며칠 뒤에나 안다. 특히 아래 「판정이 실패하면 막는다」가 이 파일의 핵심이다 —
 * 예전에는 `check-ignore` 의 종료 코드 128 을 「저장소 밖」으로 읽었는데,
 * git 문서상 128 은 「치명적 오류」라 다른 이유로 터지는 날 main 편집이 통째로 열렸다.
 */
const root = '/home/user/repo';

/** 무시 목록을 흉내낸다. 실패를 보려면 throws 를 넘긴다 */
const ignoring = (...ignored) => {
  const abs = ignored.map((p) => path.resolve(root, p));
  return (filePath) => abs.includes(path.resolve(filePath));
};
const failing = () => {
  throw new Error('fatal: not a git repository');
};

describe('inside — 저장소 안인지는 경로로 본다', () => {
  it('저장소 아래 파일은 안이다', () => {
    expect(inside(root, `${root}/server/src/index.ts`)).toBe(true);
  });

  it('저장소 루트 자신도 안이다', () => {
    expect(inside(root, root)).toBe(true);
  });

  it('이름이 앞부분만 같은 이웃은 밖이다', () => {
    expect(inside(root, '/home/user/repo-backup/x.ts')).toBe(false);
  });

  it('스크래치패드는 밖이다 — 시안 아티팩트의 원본이 여기 산다', () => {
    expect(inside(root, '/tmp/scratch/design.html')).toBe(false);
  });
});

describe('committable — main 에서 막을 값어치가 있나', () => {
  it('저장소 안의 보통 파일은 막는다', () => {
    expect(committable(`${root}/README.md`, { repoRoot: root, isIgnored: ignoring() })).toBe(true);
  });

  it('gitignore 대상은 놓아준다 — 커밋될 일이 없다', () => {
    const isIgnored = ignoring('docs/개발-노트.md');
    expect(committable(`${root}/docs/개발-노트.md`, { repoRoot: root, isIgnored })).toBe(false);
  });

  it('저장소 밖은 놓아준다 — /design 이 스크래치패드에 원본을 쓴다', () => {
    expect(committable('/tmp/scratch/design.html', { repoRoot: root, isIgnored: failing })).toBe(
      false,
    );
  });

  it('★ 판정이 실패하면 막는다 — 종료 코드를 「밖」으로 읽지 않는다', () => {
    expect(committable(`${root}/README.md`, { repoRoot: root, isIgnored: failing })).toBe(true);
  });

  it('저장소 루트를 못 읽어도 막는 쪽으로 떨어진다', () => {
    expect(committable(`${root}/README.md`, { repoRoot: null, isIgnored: failing })).toBe(true);
  });
});

describe('isIgnored — check-ignore 의 종료 코드를 판정으로 옮긴다', () => {
  /**
   * 🔴 **실제로 틀렸던 줄이 여기다.** 예전에는 128(치명적 오류)을 「저장소 밖」으로 읽어서,
   * git 이 다른 이유로 터지는 날 main 편집이 통째로 열렸다. 「아니다」는 1 뿐이다.
   */
  const exiting = (status) => () => {
    if (status === 0) return;
    throw Object.assign(new Error(`check-ignore exit ${status}`), { status });
  };

  it('0 이면 무시되는 파일이다', () => {
    expect(isIgnored('docs/개발-노트.md', exiting(0))).toBe(true);
  });

  it('1 이면 무시되지 않는 파일이다 — 이것만이 「아니다」다', () => {
    expect(isIgnored('README.md', exiting(1))).toBe(false);
  });

  it('★ 128 은 「아니다」가 아니라 오류다 — 삼켜서 통과시키지 않는다', () => {
    expect(() => isIgnored('/tmp/x', exiting(128))).toThrow();
  });

  it('종료 코드가 없는 실패(git 실행 자체 실패)도 던진다', () => {
    expect(() =>
      isIgnored('README.md', () => {
        throw new Error('ENOENT');
      }),
    ).toThrow();
  });
});

describe('★ 심볼릭 링크를 지나도 같은 답을 낸다', () => {
  /**
   * git 은 물리 경로를(`rev-parse --show-toplevel`), 훅은 논리 경로를 받는다.
   * 둘을 그냥 비교하면 링크를 지나는 저장소에서 「밖이다」가 되어 훅이 조용히 꺼진다.
   *
   * ⚠️ 만드는 것은 `beforeAll` 이다. `describe` 본문은 **수집 단계**에 돌아서,
   * `-t` 로 다른 케이스만 골라 돌려도 디렉터리가 생긴다. 1층은 매 커밋에 도는 층이라
   * 흔적을 남기면 그만큼 쌓인다.
   */
  let temp;
  let physical;
  let link;

  beforeAll(() => {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-branch-'));
    physical = path.join(temp, 'physical');
    link = path.join(temp, 'link');
    fs.mkdirSync(path.join(physical, 'docs'), { recursive: true });
    fs.symlinkSync(physical, link);
  });

  afterAll(() => {
    fs.rmSync(temp, { recursive: true, force: true });
  });

  it('링크로 들어온 파일도 저장소 안이다', () => {
    // git 은 물리 경로를 주고, 편집 요청은 링크 경로로 온다
    expect(inside(physical, path.join(link, 'docs/05.md'))).toBe(true);
  });

  it('아직 없는 파일도 있는 조상까지 풀어서 판정한다', () => {
    expect(inside(physical, path.join(link, 'docs/새-파일.md'))).toBe(true);
  });

  it('realPath 는 풀 수 있는 조상이 없으면 논리 경로를 그대로 준다', () => {
    expect(realPath('/없는뿌리/x.md')).toBe(path.resolve('/없는뿌리/x.md'));
  });
});
