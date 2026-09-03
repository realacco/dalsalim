import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/**
 * 서버 린트 규칙.
 *
 * 포매팅은 Prettier 가 전담한다 (eslint-config-prettier 가 충돌 규칙을 끈다).
 * 여기서는 **사람이 놓치는 것**만 잡는다 — 스타일은 논쟁거리가 아니라 도구의 몫이다.
 */
export default tseslint.config(
  { ignores: ['node_modules/**', 'prisma/migrations/**', '**/*.mjs'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  {
    files: ['src/**/*.ts'],
    // index.ts 는 부팅 파일이라 라우트를 등록해야 한다. 유일한 예외다
    ignores: ['src/index.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // any 로 빠져나가지 않는다 (CLAUDE.md 코드 규칙)
      '@typescript-eslint/no-explicit-any': 'error',

      // 안 쓰는 코드를 남기지 않는다. _ 로 시작하면 의도적으로 버린 것
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // await 를 빠뜨리면 트랜잭션 경계가 조용히 깨진다. 이 앱에서 제일 비싼 실수다
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      /**
       * 임포트 방향은 위에서 아래로만: routes → services → lib
       * (CLAUDE.md 폴더 구조). 어기면 순환 참조가 생기고 테스트가 불가능해진다.
       */
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/routes/*'],
              message: 'routes 는 다른 곳에서 임포트하지 않는다. 라우트끼리도 금지 (CLAUDE.md)',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/index.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },

  {
    // services 는 routes 를 몰라야 하고, lib 은 그 위를 몰라야 한다
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/routes/*', '**/services/*'],
              message: 'lib 은 가장 아래층이다. services·routes 를 임포트하지 않는다 (CLAUDE.md)',
            },
          ],
        },
      ],
    },
  },

  {
    // process.env 는 env.ts 에서만 읽는다 (CLAUDE.md)
    files: ['src/**/*.ts'],
    ignores: ['src/env.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'process.env 는 env.ts 에서만 읽는다 (CLAUDE.md 폴더 구조)',
        },
      ],
    },
  },
);
