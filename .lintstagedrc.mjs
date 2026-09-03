/**
 * 커밋 직전에 **스테이징된 파일만** 손본다.
 *
 * 전체 lint 는 8초씩 걸린다. 커밋마다 그러면 --no-verify 로 도망가게 되고
 * 그 순간 훅은 없는 것과 같다 — 그래서 여기서는 바뀐 파일만 본다.
 * 전체 검사는 CI 의 몫이다 (M-4).
 *
 * eslint 설정이 server/ · mobile/ 로 갈려 있어 각 패키지 안에서 돌려야 한다.
 * 포매팅은 Prettier 가 전담하므로(eslint-config-prettier) prettier → eslint 순으로 간다.
 */
const quote = (files) => files.map((file) => JSON.stringify(file)).join(' ');

export default {
  'server/**/*.ts': (files) => [
    `prettier --write ${quote(files)}`,
    `npm --prefix server run lint:fix -- ${quote(files)}`,
  ],
  'mobile/**/*.{ts,tsx}': (files) => [
    `prettier --write ${quote(files)}`,
    `npm --prefix mobile run lint:fix -- ${quote(files)}`,
  ],
  '*.{mjs,json}': 'prettier --write',
  '{scripts,tests}/**/*.{mjs,ts}': 'prettier --write',
  '{server,mobile}/**/*.{mjs,js,json}': 'prettier --write',
  '.github/**/*.{yml,yaml}': 'prettier --write',
};
