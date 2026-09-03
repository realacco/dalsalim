import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * FSD 임포트 방향: app → screens → widgets → features → entities → shared
 *
 * 각 레이어는 **자기보다 위층과 같은 층**을 임포트할 수 없다.
 * 규칙을 CLAUDE.md 에 적어두기만 했더니 아무도 확인하지 못했다 — 린트로 강제한다.
 */
const LAYERS = ['app', 'screens', 'widgets', 'features', 'entities', 'shared'];

function forbiddenFor(layer) {
  const index = LAYERS.indexOf(layer);
  const upper = LAYERS.slice(0, index).map((name) => `@/${name}/*`);

  // shared 는 예외다. ui 가 config(theme) 를, api 가 lib 을 쓰는 건 정상이고,
  // "같은 레이어 금지"는 슬라이스(entities·features·widgets)에 대한 규칙이다.
  if (layer === 'shared') return upper;

  return [...upper, `@/${layer}/*`];
}

const layerRules = LAYERS.map((layer) => ({
  files: [`src/${layer}/**/*.{ts,tsx}`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: forbiddenFor(layer),
            message: `FSD 위반: ${layer} 는 위층과 같은 층을 임포트할 수 없다 (app → screens → widgets → features → entities → shared)`,
          },
        ],
      },
    ],
  },
}));

export default tseslint.config(
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'web-build/**', 'scripts/**', '*.mjs'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  prettier,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      /**
       * ★ 훅 순서가 바뀌면 앱이 통째로 죽는다.
       * JSX 안에서 부르는 헬퍼에 useTheme() 을 넣었다가 실제로 크래시를 겪었다
       * (시행착오 — "React has detected a change in the order of Hooks").
       * 이 규칙 하나가 그 사고를 사전에 잡는다.
       */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /**
       * react-hooks v7 이 새로 넣은 규칙 둘은 우리 코드에서 오탐이다.
       *
       *  - refs: `useRef(new Animated.Value(0)).current` 는 RN 애니메이션의 표준 관용구다.
       *    ref 가 담고 있는 건 렌더 상태가 아니라 네이티브 드라이버로 넘길 안정적인 객체다.
       *  - set-state-in-effect: 바깥 값이 바뀌었을 때 내부 상태를 버리는 데 실제로 필요하다.
       *    (AmountInput 이 value=null 이면 담아둔 금액을 비우는 것)
       *
       * 규칙이 옳은 곳까지 막지 않도록 끄는 대신 warn 으로 둬서 눈에는 띄게 한다.
       */
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  ...layerRules,

  {
    /**
     * 서버 통신은 entities/<domain>/api 를 거친다 (CLAUDE.md).
     * 화면에서 api() 를 직접 부르면 쿼리 키가 흩어지고 에러 처리가 제각각이 된다.
     */
    files: ['src/{app,screens,widgets,features}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/shared/api/client',
              importNames: ['api'],
              message:
                '화면에서 api() 를 직접 부르지 않는다. entities/<domain>/api 를 거친다 (CLAUDE.md)',
            },
          ],
        },
      ],
    },
  },

  {
    /**
     * entities 의 model 은 순수해야 한다 — 도메인 규칙은 화면 없이도 검증 가능해야 한다.
     * (react 를 임포트하는 순간 테스트에 렌더러가 필요해진다)
     */
    files: ['src/entities/*/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'entities/model 은 순수 함수만 둔다 (CLAUDE.md)' },
            { name: 'react-native', message: 'entities/model 은 순수 함수만 둔다 (CLAUDE.md)' },
          ],
        },
      ],
    },
  },
);
