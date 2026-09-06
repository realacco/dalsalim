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

const PROCESS_DOC = '.claude/process/start-task.md';
const FEATURE_ID = /F-[A-Z]+-\d{2}/;

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
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
    // git 이 추적하지 않는 파일은 커밋될 일이 없으므로 막을 이유도 없다
    try {
      execFileSync('git', ['check-ignore', '-q', filePath], { stdio: 'ignore' });
      return;
    } catch {
      /* 무시되지 않는 파일 — 계속 검사한다 */
    }

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
