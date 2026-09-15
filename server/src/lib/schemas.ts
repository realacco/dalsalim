import { z } from 'zod';

import { CATEGORIES } from './shared.js';

/**
 * 라우트 여럿이 같이 쓰는 zod 조각. 라우트끼리는 서로 임포트할 수 없으므로 여기 둔다.
 * 메시지는 화면에 그대로 뜬다 — 해요체 (CLAUDE.md 말투 규칙).
 */
export const displayName = z.string().trim().min(1, '이름을 입력해주세요.').max(20);
export const amount = z.number().int().min(0).max(1_000_000_000);
export const category = z.enum(CATEGORIES, { error: '분류를 골라주세요.' });
export const dayOfMonth = z.number().int().min(1).max(31).nullable().optional();
/**
 * 결산 스위치 (F-FIX-07). 안 보내면 등록 때는 분류로 기본값을 정하고, 수정 때는 안 건드린다 —
 * 그래서 optional 이지 default 가 아니다. 여기서 기본값을 채우면 이름만 고쳐도 스위치가 꺼진다.
 */
export const settles = z.boolean().optional();

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

/**
 * 정산일 알림 (F-FAM-10). 날짜·시각은 한 덩어리다 — 셋을 같이 보내거나 null 로 지운다.
 * 반쪽만 저장되는 상태를 만들지 않으려고 낱개 optional 이 아니라 객체 하나로 받는다.
 */
export const settlement = z
  .object({
    day: z
      .number()
      .int()
      .min(1, '정산일은 1일부터 31일 사이예요.')
      .max(31, '정산일은 1일부터 31일 사이예요.'),
    hour: z
      .number()
      .int()
      .min(0, '시각은 0시부터 23시 사이예요.')
      .max(23, '시각은 0시부터 23시 사이예요.'),
    minute: z.number().int().min(0, '분은 0부터 59 사이예요.').max(59, '분은 0부터 59 사이예요.'),
  })
  .nullable();

/** Expo 푸시 토큰. 다른 모양은 우리 서버가 보낼 수 없는 주소다 */
export const pushToken = z
  .string()
  .regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, '알림을 받을 기기 정보가 올바르지 않아요.');
