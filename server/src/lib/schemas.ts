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
