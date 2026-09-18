#!/usr/bin/env node
/**
 * 관문 — 코드를 고치려는 순간 절차를 밟게 한다. (CLAUDE.md 「작업 흐름」)
 *
 * `/task` 를 부르는 건 자발적인 행동이라 바쁠 때 잊힌다. 그래서 방아쇠를 뒤집었다 —
 * 부를 때가 아니라 **파일을 고치려 할 때** 막고, 차단 메시지가 절차 파일을 가리킨다.
 * 잊고 그냥 일을 시켜도 여기서 걸리고, 첫 편집 시도에서 걸리므로 작업을 잃지도 않는다.
 *
 * 막는 것은 둘뿐이다. 나머지는 다 통과시킨다 — 훅이 성가시면 우회당한다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PROCESS_DOC = '.claude/process/start-task.md';
const FEATURE_ID = /F-[A-Z]+-\d{2}/;

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

/**
 * 심볼릭 링크를 푼 경로. **경로 둘을 비교하기 전에 둘 다 여기를 지난다.**
 *
 * 🔴 논리 경로와 물리 경로를 섞어 비교하면 안 된다. `rev-parse --show-toplevel` 은 git 이
 * `getcwd()` 로 얻은 **물리** 경로고, 훅이 받는 `file_path` 와 Node 의 `argv[1]` 은 **논리**
 * 경로다. 저장소가 링크를 지나는 자리에 있으면(`~/dev` → `/Volumes/Data/dev` 같은 흔한 모양)
 * 둘이 갈리고, 갈린 결과는 늘 「밖이다 · 아니다」 쪽으로 떨어져 **훅이 조용히 꺼진다.**
 *
 * 대상 파일은 아직 없을 수 있어서(`Write` 로 새로 만들 때) **있는 조상까지만** 푼다.
 */
export function realPath(target) {
  let current = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      return path.join(fs.realpathSync(current), ...rest);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target); // 풀 수 있는 조상이 없다
      rest.unshift(path.basename(current));
      current = parent;
    }
  }
}

/** 저장소 안에 있는 경로인가 — 종료 코드가 아니라 경로로 판정한다 */
export function inside(repoRoot, filePath) {
  const root = realPath(repoRoot);
  const target = realPath(filePath);
  return target === root || target.startsWith(root + path.sep);
}

/**
 * 커밋될 수 있는 파일인가 — `main` 에서 막을 값어치가 있는지의 판정.
 *
 * 저장소 밖도 커밋될 수 없다. `/design` 이 시안 아티팩트의 원본을 스크래치패드에 쓰는데
 * 그 절차는 브랜치를 만들기 전(보통 `main`)에 돌기 때문이다.
 *
 * 🔴 **「저장소 밖」과 「판정 실패」를 한 값에 섞지 않는다.** 밖인지는 **경로로** 보고,
 * `check-ignore` 가 터지면 **막는 쪽**으로 떨어진다. 섞으면(예: 종료 코드 128 을 「밖」으로 읽으면)
 * git 이 다른 이유로 터지는 날 `main` 편집이 통째로 열린다 — 128 은 git 문서상 「치명적 오류」고
 * 「저장소 밖」은 그 여러 원인 중 하나일 뿐이다. 게다가 **안 막는 훅은 아무 흔적을 안 남겨서**
 * 꺼진 줄도 모른다.
 */
export function committable(filePath, { repoRoot, isIgnored }) {
  if (repoRoot && !inside(repoRoot, filePath)) return false;
  try {
    return !isIgnored(filePath);
  } catch {
    return true; // 판정에 실패하면 막는 쪽으로
  }
}

const checkIgnore = (args) => execFileSync('git', args, { stdio: 'ignore' });

/**
 * gitignore 대상인가 — `check-ignore` 의 종료 코드를 판정으로 옮기는 자리.
 *
 * 0 = 무시됨 · 1 = 아님 · 그 밖 = 오류. **「아니다」는 1 뿐이고** 나머지는 그대로 던져
 * 위에서 막는 쪽으로 보낸다. 실제로 틀렸던 줄이 여기라 `exec` 를 주입받는다 — 이 번역만
 * 떼어 테스트하기 위해서다.
 */
export function isIgnored(filePath, exec = checkIgnore) {
  try {
    exec(['check-ignore', '-q', filePath]);
    return true;
  } catch (caught) {
    if (caught?.status === 1) return false;
    throw caught;
  }
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

function main(input) {
  const filePath = input?.tool_input?.file_path;
  if (!filePath) return;

  let branch;
  try {
    branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  } catch {
    return; // git 저장소가 아니면 관여하지 않는다
  }

  if (branch === 'main' || branch === 'master') {
    // 커밋될 일이 없는 파일은 막을 이유도 없다
    let repoRoot = null;
    try {
      repoRoot = git('rev-parse', '--show-toplevel');
    } catch {
      /* 못 읽으면 밖인지 모르는 것이다 — 아래 check-ignore 판정에만 맡긴다 */
    }
    if (!committable(filePath, { repoRoot, isIgnored })) return;

    deny(
      `${branch} 에서는 파일을 고치지 않아요. 브랜치를 먼저 만들어야 해요.\n` +
        `\n` +
        `무엇을 하려는지에 따라 갈립니다.\n` +
        `  • 기능 작업이면 → ${PROCESS_DOC} 를 읽고 그 절차를 밟으세요 (문서 → 이슈 → 브랜치)\n` +
        `  • 오타·의존성·CI·문서면 → chore/ docs/ ci/ deps/ 로 브랜치를 열면 기능 ID 없이 지나갑니다\n`,
    );
  }

  if (branch.startsWith('feat/') && !FEATURE_ID.test(branch)) {
    deny(
      `feat/ 브랜치에는 기능 ID 가 필요해요 — 지금은 "${branch}" 예요.\n` +
        `\n` +
        `  feat/F-FAM-05-approve-join 처럼 지어주세요.\n` +
        `  어느 기능인지 모르겠으면 ${PROCESS_DOC} 의 ① 부터 밟으세요.\n` +
        `  기능이 아닌 작업이면 chore/ 로 바꾸면 됩니다.\n`,
    );
  }
}

function run() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => (raw += chunk));
  process.stdin.on('end', () => {
    try {
      main(JSON.parse(raw || '{}'));
    } catch {
      /* 훅이 터져서 작업을 막는 일은 없어야 한다 */
    }
  });
}

// 테스트가 위 판정 함수만 떼어 쓸 수 있게, 훅으로 불릴 때만 stdin 을 연다.
// 양쪽 다 realPath 를 지난다 — Node 는 모듈 경로의 링크를 풀지만 argv[1] 은 안 푼다
if (process.argv[1] && realPath(process.argv[1]) === realPath(fileURLToPath(import.meta.url)))
  run();
