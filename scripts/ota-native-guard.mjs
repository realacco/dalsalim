#!/usr/bin/env node
/**
 * OTA 로 내보내면 안 되는 변경을 막는다. `.github/workflows/ota.yml` 에서 돈다.
 *
 * 왜 있나: `eas update` 는 **JS 번들만** 바꾼다. 네이티브가 바뀐 코드를 OTA 로 내보내면
 * 새 JS 가 옛 런타임 위에 내려앉아 앱이 죽는다. 그런데 발행 자체는 초록으로 성공한다 —
 * 사람이 알아채는 건 가족이 "앱이 안 켜져요" 라고 말할 때다.
 * 그때는 이미 폰에 내려가 있고, 고친 것을 다시 쏴도 **앱을 켜야** 받는다.
 *
 * 두 곳을 본다. 하나만 봐서는 안 된다 —
 *
 *   app.json      런타임 · 플러그인 · 패키지명처럼 네이티브 껍데기를 정하는 것
 *   package.json  **네이티브 모듈이 늘어나는 가장 흔한 길이 이쪽이다.**
 *                 config plugin 이 필요 없는 모듈은 `expo install` 로 넣어도
 *                 app.json 이 그대로라, app.json 만 보면 통과해버린다
 *
 * 두 곳 다 **안전한 것만 빼놓는 방향**으로 짠다. 반대로(위험한 것을 세는 쪽으로) 짜면
 * Expo 가 키를 새로 만들거나 새 라이브러리가 들어올 때마다 조용히 구멍이 생긴다 —
 * 모르는 것은 막는 쪽이 맞다.
 *
 * 빠져나가는 법: 워크플로의 `force` 입력을 켠다. 재빌드까지 끝냈는데 막힐 때,
 * 그리고 순수 JS 라이브러리만 늘었을 때 쓴다. 그래서 무엇이 바뀌었는지 이름까지 찍어준다 —
 * 5초 안에 판단이 서야 force 가 습관이 되지 않는다.
 *
 * 무엇을 막고 무엇을 놓아주는지는 tests/tools/ota-native-guard.test.mjs 가 지킨다.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * app.json 에서 바뀌어도 OTA 로 안전한 것.
 *
 * `version` 과 `versionCode` 가 여기 있는 이유는 이 프로젝트가 `runtimeVersion` 을
 * **손으로** 올리는 정책이기 때문이다 (README 「세 개의 숫자」). fingerprint 정책이었다면
 * 버전만 바꿔도 지문이 달라져 OTA 가 끊기므로 여기 둘 수 없다.
 *
 * 전부 **잎(leaf)** 이다. 가지를 통째로 열면 그 안쪽은 Expo 가 무엇을 새로 넣든
 * 무사통과해서, 이 파일이 세운 원칙이 거기서만 뒤집힌다.
 */
export const OTA_SAFE_PATHS = [
  'version',
  'android.versionCode',
  'ios.buildNumber',
  // 라우팅 타입 생성 — 빌드 시점에 JS 로만 반영된다
  'experiments.typedRoutes',
];

/**
 * { a: { b: 1 } } → { 'a.b': 1 }. 배열은 통째로 하나의 값으로 본다.
 *
 * 빈 객체를 잎으로 남기는 것이 중요하다. 안 그러면 그 경로가 통째로 사라져
 * `extra: { router: {} }` 를 지워도 아무 말 없이 통과한다.
 */
function flatten(value, prefix = '', out = {}) {
  const isPlainObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!isPlainObject || Object.keys(value).length === 0) {
    out[prefix] = JSON.stringify(value);
    return out;
  }
  for (const [key, child] of Object.entries(value)) {
    flatten(child, prefix ? `${prefix}.${key}` : key, out);
  }
  return out;
}

function isSafe(keyPath) {
  return OTA_SAFE_PATHS.includes(keyPath);
}

/**
 * 두 app.json 사이에서 재빌드가 필요한 변경을 찾는다.
 *
 * @param {object} before 지난 발행 시점의 app.json (파싱된 것)
 * @param {object} after  지금 app.json
 * @returns {string[]} 바뀐 키 경로
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

/**
 * 두 package.json 사이에서 바뀐 의존성을 찾는다.
 *
 * 네이티브인지 아닌지는 **여기서 알 수 없다.** `expo-haptics` 도 `date-fns` 도
 * package.json 에서는 똑같이 한 줄이다. 그래서 전부 보고하고 판단은 사람에게 넘긴다 —
 * 이 가드가 막으려는 실패가 "조용히 통과" 쪽이라, 갈림길에서는 시끄러운 쪽을 고른다.
 *
 * devDependencies 는 보지 않는다. 번들에 안 실린다.
 *
 * @returns {string[]} `추가 expo-haptics` 처럼 무엇이 어떻게 바뀌었는지
 */
export function dependencyChanges(before, after) {
  const a = before?.dependencies ?? {};
  const b = after?.dependencies ?? {};

  const changed = [];
  for (const name of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
    if (a[name] === b[name]) continue;
    if (!(name in a)) changed.push(`추가  ${name}@${b[name]}`);
    else if (!(name in b)) changed.push(`삭제  ${name}`);
    else changed.push(`변경  ${name}  ${a[name]} → ${b[name]}`);
  }
  return changed;
}

function main() {
  const [appBefore, appAfter, pkgBefore, pkgAfter] = process.argv.slice(2);
  if (!appBefore || !appAfter || !pkgBefore || !pkgAfter) {
    console.error(
      '사용법: node scripts/ota-native-guard.mjs <이전 app.json> <지금 app.json> <이전 package.json> <지금 package.json>',
    );
    process.exit(2);
  }

  const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
  const native = nativeChanges(read(appBefore), read(appAfter));
  const deps = dependencyChanges(read(pkgBefore), read(pkgAfter));

  if (native.length === 0 && deps.length === 0) {
    console.log('네이티브 설정도 의존성도 그대로다. OTA 로 내보내도 된다');
    return;
  }

  console.error('지난 발행 뒤에 바뀐 것이 있다 — OTA 로 내보내면 앱이 죽을 수 있다\n');

  if (native.length > 0) {
    console.error('app.json — 네이티브 껍데기가 바뀌었다. 재빌드가 필요하다');
    for (const key of native) console.error(`  expo.${key}`);
    console.error('');
  }

  if (deps.length > 0) {
    console.error('package.json — 의존성이 바뀌었다');
    for (const line of deps) console.error(`  ${line}`);
    console.error(
      '  네이티브 모듈이면 재빌드가 필요하고, 순수 JS 라이브러리면 force 로 지나가면 된다',
    );
    console.error('');
  }

  console.error('재빌드가 필요하면 eas build 로 APK 를 새로 굽고 가족이 다시 설치해야 한다.');
  console.error('이미 재빌드까지 끝났거나 순수 JS 변경뿐이라면 워크플로를 force 로 다시 돌린다.');
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
