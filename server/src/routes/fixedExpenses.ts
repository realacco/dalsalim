import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireMembership, requireUser } from '../lib/auth.js';
import { amount, category, dayOfMonth } from '../lib/schemas.js';
import {
  createFixedExpense,
  deactivateFixedExpense,
  findFixedExpense,
  listFixedExpensesByMember,
  updateFixedExpense,
} from '../services/fixed-expense.js';

export async function fixedExpenseRoutes(app: FastifyInstance) {
  /** 가족 전체의 고정비를 사람별로 묶어서 돌려준다 */
  app.get('/families/:familyId/fixed-expenses', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const mine = await requireMembership(user.id, familyId);

    const members = await listFixedExpensesByMember(familyId);
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

    const { membershipId, ...input } = z
      .object({
        membershipId: z.string(),
        name: z.string().trim().min(1).max(30),
        category,
        defaultAmount: amount,
        dayOfMonth,
      })
      .parse(request.body);

    return { fixedExpense: await createFixedExpense(familyId, membershipId, input) };
  });

  app.patch('/fixed-expenses/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const existing = await findFixedExpense(id);
    await requireMembership(user.id, existing.familyId);

    const body = z
      .object({
        name: z.string().trim().min(1).max(30).optional(),
        category: category.optional(),
        defaultAmount: amount.optional(),
        dayOfMonth,
      })
      .parse(request.body);

    return { fixedExpense: await updateFixedExpense(id, body) };
  });

  app.delete('/fixed-expenses/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const existing = await findFixedExpense(id);
    await requireMembership(user.id, existing.familyId);

    await deactivateFixedExpense(id);
    return { ok: true };
  });
}
