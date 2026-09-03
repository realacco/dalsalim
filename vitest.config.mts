import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * 1층 테스트 — 순수 함수 (CLAUDE.md 테스트 규칙 3층 중 1층).
 *
 * 러너 하나로 세 묶음을 돈다. 패키지마다 vitest 를 따로 깔면 버전이 갈리고,
 * 무엇보다 **서버와 앱을 한 파일에서 비교하는 계약 테스트**를 둘 곳이 없어진다.
 *
 *   server    도메인 규칙 · 에러 계약
 *   mobile    표시 형식 · 앱 쪽 사유 판정
 *   contract  ★ 서버와 앱에 각각 있는 같은 함수가 진짜 같은지
 *   tools     커밋 훅이 쓰는 스크립트 (비밀 스캔 규칙)
 *
 * 2층(API 흐름)은 server/scripts/smoke.mjs, 3층(화면)은 사람이 에뮬레이터에서 본다.
 */
const here = import.meta.dirname;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'server',
          root: path.resolve(here, 'server'),
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: { alias: { '@': path.resolve(here, 'mobile/src') } },
        test: {
          name: 'mobile',
          root: path.resolve(here, 'mobile'),
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'contract',
          root: here,
          include: ['tests/contract/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'tools',
          root: here,
          include: ['tests/tools/**/*.test.mjs'],
          environment: 'node',
        },
      },
    ],
  },
});
