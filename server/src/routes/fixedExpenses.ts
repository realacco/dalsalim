import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../db.js';
import { requireMembership, requireUser } from '../auth.js';
import { badRequest, notFound } from '../lib/http.js';
import { CATEGORIES } from '../lib/shared.js';

const category = z.enum(CATEGORIES);
const amount = z.number().int().min(0).max(1_000_000_000);
const dayOfMonth = z.number().int().min(1).max(31).nullable().optional();

export async function fixedExpenseRoutes(app: FastifyInstance) {
  /** 가족 전체의 고정비를 사람별로 묶어서 돌려준다 */
  app.get('/families/:familyId/fixed-expenses', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireMembership(user.id, familyId);

    const members = await prisma.membership.findMany({
      where: { familyId },
      orderBy: { sortOrder: 'asc' },
      include: {
        fixedExpenses: {
          where: { active: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    return {
      myMembershipId: mine.id,
      groups: members.map((m) => ({
        membershipId: m.id,
        displayName: m.displayName,
        isMe: m.id === mine.id,
        items: m.fixedExpenses.map((f) => ({
          id: f.id,
          name: f.name,
          category: f.category,
          defaultAmount: f.defaultAmount,
          dayOfMonth: f.dayOfMonth,
        })),
        monthlyTotal: m.fixedExpenses.reduce((sum, f) => sum + f.defaultAmount, 0),
      })),
    };
  });

  app.post('/families/:familyId/fixed-expenses', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    await requireMembership(user.id, familyId);

    const body = z
      .object({
        membershipId: z.string(),
        name: z.string().trim().min(1).max(30),
        category,
        defaultAmount: amount,
        dayOfMonth,
      })
      .parse(request.body);

    // 다른 가족의 멤버 id 를 넣어 남의 집에 항목을 꽂는 걸 막는다
    const target = await prisma.membership.findUnique({ where: { id: body.membershipId } });
    if (!target || target.familyId !== familyId) {
      throw badRequest('BAD_MEMBERSHIP', '이 가족의 구성원이 아닙니다.');
    }

    const count = await prisma.fixedExpense.count({ where: { membershipId: body.membershipId } });

    const created = await prisma.fixedExpense.create({
      data: {
        familyId,
        membershipId: body.membershipId,
        name: body.name,
        category: body.category,
        defaultAmount: body.defaultAmount,
        dayOfMonth: body.dayOfMonth ?? null,
        sortOrder: count,
      },
    });

    return { fixedExpense: created };
  });

  app.patch('/fixed-expenses/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.fixedExpense.findUnique({ where: { id } });
    if (!existing) throw notFound('고정비 항목을 찾을 수 없습니다.');
    await requireMembership(user.id, existing.familyId);

    const body = z
      .object({
        name: z.string().trim().min(1).max(30).optional(),
        category: category.optional(),
        defaultAmount: amount.optional(),
        dayOfMonth,
      })
      .parse(request.body);

    const updated = await prisma.fixedExpense.update({ where: { id }, data: body });
    return { fixedExpense: updated };
  });

  /**
   * 삭제는 실제로 지우지 않고 active=false 로 내린다.
   * 지난달 기록의 EntryLine 이 이 항목을 참조하고 있어, 지우면 과거 추이가 끊긴다.
   */
  app.delete('/fixed-expenses/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);

    const existing = await prisma.fixedExpense.findUnique({ where: { id } });
    if (!existing) throw notFound('고정비 항목을 찾을 수 없습니다.');
    await requireMembership(user.id, existing.familyId);

    await prisma.fixedExpense.update({ where: { id }, data: { active: false } });
    return { ok: true };
  });
}
