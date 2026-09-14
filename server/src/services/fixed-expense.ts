// 기능: F-FIX-01 F-FIX-02 F-FIX-03 F-FIX-04 F-FIX-07
import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import { ACTIVE_MEMBER, defaultSettles } from '../lib/shared.js';

export type FixedExpenseInput = {
  name: string;
  description?: string | null;
  category: string;
  defaultAmount: number;
  dayOfMonth?: number | null;
  /** 결산 스위치. 등록 때 안 보내면 분류로 정한다 (F-FIX-07) */
  settles?: boolean;
};

/** 가족 전체의 고정비를 사람별로 — 구성원은 ACTIVE 만, 항목은 active 만 */
export function listFixedExpensesByMember(familyId: string) {
  return prisma.membership.findMany({
    where: { familyId, ...ACTIVE_MEMBER },
    orderBy: { sortOrder: 'asc' },
    include: {
      fixedExpenses: {
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
}

export async function createFixedExpense(
  familyId: string,
  membershipId: string,
  input: FixedExpenseInput,
) {
  // 다른 가족의 멤버 id 를 넣어 남의 집에 항목을 꽂는 걸 막는다
  const target = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!target || target.familyId !== familyId || target.status !== 'ACTIVE') {
    throw fail('BAD_MEMBERSHIP');
  }

  const count = await prisma.fixedExpense.count({ where: { membershipId } });

  return prisma.fixedExpense.create({
    data: {
      familyId,
      membershipId,
      name: input.name,
      description: input.description ?? null,
      category: input.category,
      defaultAmount: input.defaultAmount,
      dayOfMonth: input.dayOfMonth ?? null,
      // 안 보냈을 때만 분류가 정한다. 보낸 값이 있으면 그대로 — 생활비라도 끌 수 있어야 한다
      settles: input.settles ?? defaultSettles(input.category),
      sortOrder: count,
    },
  });
}

/** 있는 항목인지 확인하고 돌려준다. 라우트는 이걸로 familyId 를 알아내 권한을 확인한다 */
export async function findFixedExpense(id: string) {
  const existing = await prisma.fixedExpense.findUnique({ where: { id } });
  if (!existing) throw fail('FIXED_EXPENSE_NOT_FOUND');
  return existing;
}

export function updateFixedExpense(id: string, input: Partial<FixedExpenseInput>) {
  return prisma.fixedExpense.update({ where: { id }, data: input });
}

/**
 * 삭제는 실제로 지우지 않고 active=false 로 내린다 (하드룰 6).
 * 지난달 기록의 EntryLine 이 이 항목을 참조하고 있어, 지우면 과거 추이가 끊긴다.
 */
export function deactivateFixedExpense(id: string) {
  return prisma.fixedExpense.update({ where: { id }, data: { active: false } });
}
