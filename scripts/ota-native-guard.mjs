#!/usr/bin/env node
/**
 * OTA 로 내보내면 안 되는 변경을 막는다. `.github/workflows/ota.yml` 에서 돈다.
 *
 * 왜 있나: `eas update` 는 **JS 번들만** 바꾼다. 네이티브 설정이 바뀐 코드를 OTA 로 내보내면
 * 새 JS 가 옛 런타임 위에 내려앉아 앱이 죽는다. 그런데 발행 자체는 초록으로 성공한다 —
 * 사람이 알아채는 건 가족이 "앱이 안 켜져요" 라고 말할 때다.
 * 그때는 이미 폰에 내려가 있고, 고친 것을 다시 쏴도 **앱을 켜야** 받는다.
 *
 * 어떻게 판단하나: `mobile/app.json` 의 `expo` 를 지난 발행 시점과 통째로 비교하고,
 * **OTA 로 안전한 것만 빼놓는다.** 반대로(위험한 키 목록을 세는 쪽으로) 짜면
 * Expo 가 키를 새로 만들 때마다 조용히 구멍이 생긴다 — 모르는 키는 막는 쪽이 맞다.
 *
 * 빠져나가는 법: 워크플로의 `force` 입력을 켠다. 재빌드까지 끝냈는데 태그만 안 옮겼을 때 쓴다.
 *
 * 무엇을 막고 무엇을 놓아주는지는 tests/tools/ota-native-guard.test.mjs 가 지킨다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 바뀌어도 OTA 로 안전한 것.
 *
 * `version` 과 `versionCode` 가 여기 있는 이유는 이 프로젝트가 `runtimeVersion` 을
 * **손으로** 올리는 정책이기 때문이다 (README 「세 개의 숫자」). fingerprint 정책이었다면
 * 버전만 바꿔도 지문이 달라져 OTA 가 끊기므로 여기 둘 수 없다.
 */
export const OTA_SAFE_PATHS = [
  'version',
  'android.versionCode',
  'ios.buildNumber',
  // 번들러 실험 플래그 — 빌드 시점에 JS 로만 반영된다
  'experiments',
];

/** { a: { b: 1 } } → { 'a.b': 1 }. 배열은 통째로 하나의 값으로 본다 */
function flatten(value, prefix = '', out = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    out[prefix] = JSON.stringify(value);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function isSafe(keyPath) {
  return OTA_SAFE_PATHS.some((safe) => keyPath === safe || keyPath.startsWith(`${safe}.`));
}

/**
 * 두 app.json 사이에서 재빌드가 필요한 변경을 찾는다.
 *
 * @param {object} before 지난 발행 시점의 app.json (파싱된 것)
 * @param {object} after  지금 app.json
 * @returns {string[]} 바뀐 키 경로. 비어 있으면 OTA 로 내보내도 된다
 */
export function nativeChanges(before, after) {
  const a = flatten(before?.expo ?? {});
  const b = flatten(after?.expo ?? {});

  const changed = [];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (isSafe(key)) continue;
    if (a[key] !== b[key]) changed.push(key);
  }
  return changed.sort();
}

function main() {
  const [beforePath, afterPath] = process.argv.slice(2);
  if (!beforePath || !afterPath) {
    console.error('사용법: node scripts/ota-native-guard.mjs <이전 app.json> <지금 app.json>');
    process.exit(2);
  }

  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const changed = nativeChanges(read(beforePath), read(afterPath));

  if (changed.length === 0) {
    console.log('네이티브 설정이 그대로다. OTA 로 내보내도 된다');
    return;
  }

  console.error('지난 발행 뒤에 네이티브 설정이 바뀌었다 — OTA 로 내보내면 앱이 죽는다\n');
  for (const key of changed) console.error(`  expo.${key}`);
  console.error('\neas build 로 APK 를 새로 굽고 가족이 다시 설치해야 한다.');
  console.error('이미 재빌드까지 끝났다면 워크플로를 force 로 다시 돌린다.');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
