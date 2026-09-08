#!/usr/bin/env node
/**
 * 발행한 번들에 서버 주소가 실렸는지 로그로 확인한다. `.github/workflows/ota.yml` 에서 돈다.
 *
 * 왜 있나 (시행착오 1-9): `eas.json` 의 env 는 `eas update` 에 안 실린다. 빌드용과
 * 업데이트용 저장소가 달라서, EAS 서버에 등록을 안 하면 주소가 빈 번들이 나간다.
 * 앱은 켜지는데 모든 화면이 "서버에 닿지 못했어요" 가 되고, **발행은 초록으로 성공한다.**
 * 그때도 경고가 로그에 찍혀 있었는데 사람이 읽고 넘어갔다.
 *
 * 발행을 CI 로 옮기면 로그는 요약의 접힌 블록으로 들어가고 사람 눈에는 "success" 만 보인다.
 * 사람이 하던 확인을 여기서 대신한다.
 *
 * ⚠️ **변수 이름만 찾으면 안 된다.** 사람이 친 발행 메시지도 로그에 그대로 찍히므로
 * "EXPO_PUBLIC_API_URL 주소 교체" 같은 메시지가 검사를 통과시킨다 —
 * 하필 그 변수를 만지느라 쏘는 발행에서 눈을 감는다. 그래서 **성공 문구째로** 본다.
 *
 * 이 정규식은 네이티브 가드와 같은 성격이다. 조이면(문구가 조금만 달라지면) 이미 나간
 * 발행에 빨간불이 켜지고 다음부터 "또 그 오탐" 으로 읽힌다. 풀면 주소 없는 번들을 놓친다.
 * 그래서 가드와 같은 무게로 tests/tools/ota-env-check.test.mjs 가 양쪽을 지킨다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 발행 로그에 "환경변수가 실렸다" 는 줄이 있는지 본다.
 *
 * 찾는 줄 (README 「고친 것을 가족에게 보내기」):
 *   Environment variables ... loaded from the "preview" environment on EAS: EXPO_PUBLIC_API_URL.
 *
 * @param {string} log 발행 로그 전문
 * @param {{ variable: string, environment?: string }} expected
 *   environment 를 주면 **그 환경에서 실렸는지**까지 본다 — 채널과 환경이 어긋나면
 *   preview 채널에 production 주소가 실려 나갈 수 있다
 * @returns {boolean}
 */
export function envLoaded(log, { variable, environment } = {}) {
  const env = environment ? `.*${escape(environment)}` : '';
  // 한 줄 안에서 다 만나야 한다. 여러 줄에 걸쳐 이어붙이면 발행 메시지가 다시 끼어든다
  const pattern = new RegExp(`loaded from the${env}.* environment on EAS.*${escape(variable)}`);
  return String(log)
    .split('\n')
    .some((line) => pattern.test(line));
}

function main() {
  const [logPath, variable, environment] = process.argv.slice(2);
  if (!logPath || !variable) {
    console.error('사용법: node scripts/ota-env-check.mjs <발행 로그> <변수 이름> [환경 이름]');
    process.exit(2);
  }

  const log = fs.readFileSync(logPath, 'utf8');
  if (envLoaded(log, { variable, environment })) {
    console.log(`${variable} 이 번들에 실렸다`);
    return;
  }

  console.error(`${variable} 이 안 실렸다 — 주소가 빠진 번들이 나갔다 (시행착오 1-9)`);
  console.error('앱은 켜지지만 모든 화면이 "서버에 닿지 못했어요" 가 된다.');
  console.error('eas env:set 으로 등록한 뒤 다시 발행한다 — README 「고친 것을 가족에게 보내기」');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
