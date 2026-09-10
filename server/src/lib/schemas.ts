import { z } from 'zod';

import { CATEGORIES } from './shared.js';

/**
 * 라우트 여럿이 같이 쓰는 zod 조각. 라우트끼리는 서로 임포트할 수 없으므로 여기 둔다.
 * 메시지는 화면에 그대로 뜬다 — 해요체 (CLAUDE.md 말투 규칙).
 */
export const displayName = z.string().trim().min(1, '이름을 입력해주세요.').max(20);
export const amount = z.number().int().min(0).max(1_000_000_000);
export const category = z.enum(CATEGORIES);
export const dayOfMonth = z.number().int().min(1).max(31).nullable().optional();

/**
 * 고정비 항목의 한 줄 설명.
 *
 * 빈 문자열은 "안 적음"과 같은 뜻이므로 null 로 눕힌다 — 안 적은 것을 두 가지로 표현하지 않는다.
 * 다만 undefined 는 그대로 둔다. PATCH 에서 "이 칸은 안 건드림"과 "지움"이 갈리는 자리다.
 */
export const description = z
  .string()
  .trim()
  .max(60, '설명은 60자까지 적을 수 있어요.')
  .nullable()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));
