import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { committable, inside } from '../../.claude/hooks/guard-branch.mjs';

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
