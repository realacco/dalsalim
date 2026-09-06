#!/usr/bin/env node
/**
 * 상시 상기 — 지금 어느 기능을 하고 있는지 한 줄로 붙인다.
 *
 * 한 줄이라 방해가 안 되는데, **지금 무슨 작업 중인지가 항상 눈앞에 있다.**
 * 관문 훅은 파일을 고칠 때만 걸리므로, 그 전에 방향을 잡아주는 몫이 이 훅이다.
 */
import { execFileSync } from 'node:child_process';

const FEATURE_ID = /F-[A-Z]+-\d{2}/;
const PROCESS_DOC = '.claude/process/start-task.md';

function emit(text) {
  process.stdout.write(
    JSON.stringify({
      suppressOutput: true,
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: text },
    }),
  );
}

try {
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();

  if (branch === 'main' || branch === 'master') {
    emit(
      `브랜치 ${branch} — 코드를 고치기 전에 기능 ID 를 정하고 브랜치를 만들어야 해요. ` +
        `기능 작업이면 ${PROCESS_DOC} 의 절차를 밟으세요.`,
    );
  } else {
    const id = FEATURE_ID.exec(branch);
    emit(id ? `브랜치 ${branch} · 기능 ${id[0]}` : `브랜치 ${branch} (기능 ID 없음)`);
  }
} catch {
  /* git 저장소가 아니면 아무것도 붙이지 않는다 */
}
