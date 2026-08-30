import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../lib/db.js';
import { requireMembership, requireUser } from '../lib/auth.js';
import { badRequest } from '../lib/http.js';
import { isYearMonth, shiftYearMonth } from '../lib/shared.js';
import { entrySummary, serializeEntry, syncFixedLines } from '../services/entry.js';
import { buildMonthSummary, refreshBookStatus } from '../services/book.js';

const INCOME_CATEGORY = '수입';

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseYearMonth(value: string): string {
  if (!isYearMonth(value)) throw badRequest('BAD_YEAR_MONTH', "'YYYY-MM' 형식이 아닙니다.");
  return value;
}

/**
 * 월 장부는 필요할 때 만든다. 미래의 달은 만들지 않는다 —
 * 아직 오지 않은 달의 장부를 열어두면 "이 달은 아무도 안 적었다"는 잘못된 신호가 된다.
 */
async function getOrCreateBook(familyId: string, yearMonth: string) {
  const existing = await prisma.monthlyBook.findUnique({
    where: { familyId_yearMonth: { familyId, yearMonth } },
  });
  if (existing) return existing;

  if (yearMonth > currentYearMonth()) {
    throw badRequest('FUTURE_MONTH', '아직 오지 않은 달입니다.');
  }

  return prisma.monthlyBook.create({ data: { familyId, yearMonth } });
}

export async function bookRoutes(app: FastifyInstance) {
  /** 이번 달 홈 화면이 쓰는 단 하나의 엔드포인트 */
  app.get('/families/:familyId/books/:yearMonth', async (request) => {
    const user = await requireUser(request);
    const params = z.object({ familyId: z.string(), yearMonth: z.string() }).parse(request.params);
    const yearMonth = parseYearMonth(params.yearMonth);
    const mine = await requireMembership(user.id, params.familyId);

    const book = await getOrCreateBook(params.familyId, yearMonth);

    const members = await prisma.membership.findMany({
      where: { familyId: params.familyId, active: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        entries: { where: { bookId: book.id }, include: { lines: true } },
        fixedExpenses: { where: { active: true } },
      },
    });

    return {
      book: { id: book.id, yearMonth: book.yearMonth, status: book.status },
      myMembershipId: mine.id,
      isFuture: yearMonth > currentYearMonth(),
      members: members.map((m) => {
        const entry = m.entries[0] ?? null;
        // 총 스텝 = 수입 1 + 고정비 n + 추가지출 1 + 특이사항 1 + 확인 1
        const totalSteps = m.fixedExpenses.length + 4;

        return {
          membershipId: m.id,
          displayName: m.displayName,
          isMe: m.id === mine.id,
          entryId: entry?.id ?? null,
          status: entry?.status ?? 'NONE',
          progress: entry ? { step: Math.min(entry.cursor + 1, totalSteps), total: totalSteps } : null,
          summary: entry?.status === 'SUBMITTED' ? entrySummary(entry.lines) : null,
        };
      }),
    };
  });

  /**
   * 내 기록을 시작하거나 이어서 연다.
   * 처음이면 수입 1줄 + 내 고정비 n줄을 지난달 값으로 채워서 만든다.
   */
  app.post('/families/:familyId/books/:yearMonth/my-entry', async (request) => {
    const user = await requireUser(request);
    const params = z.object({ familyId: z.string(), yearMonth: z.string() }).parse(request.params);
    const yearMonth = parseYearMonth(params.yearMonth);
    const mine = await requireMembership(user.id, params.familyId);

    const book = await getOrCreateBook(params.familyId, yearMonth);

    const existing = await prisma.memberEntry.findUnique({
      where: { bookId_membershipId: { bookId: book.id, membershipId: mine.id } },
    });

    if (existing) {
      // 기록을 시작한 뒤에 고정비를 추가했을 수 있다. 작성 중이면 맞춰준다.
      await syncFixedLines(existing.id, mine.id, params.familyId, yearMonth);
      return { entry: await serializeEntry(existing.id) };
    }

    const previous = shiftYearMonth(yearMonth, -1);

    // 지난달에 내가 실제로 적은 금액들 — 이번 달 기본값의 1순위
    const lastMonthLines = await prisma.entryLine.findMany({
      where: {
        entry: { membershipId: mine.id, book: { familyId: params.familyId, yearMonth: previous } },
      },
    });

    const lastIncome = lastMonthLines.find((l) => l.kind === 'INCOME')?.actualAmount ?? null;
    const lastByFixedId = new Map(
      lastMonthLines
        // 금액이 비어 있는 줄(제출하지 않은 초안)은 기본값의 근거가 될 수 없다
        .filter((l) => l.kind === 'FIXED' && l.fixedExpenseId && l.actualAmount !== null)
        .map((l) => [l.fixedExpenseId as string, l.actualAmount as number]),
    );

    const fixedExpenses = await prisma.fixedExpense.findMany({
      where: { membershipId: mine.id, active: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const entry = await prisma.memberEntry.create({
      data: {
        bookId: book.id,
        membershipId: mine.id,
        lines: {
          create: [
            {
              kind: 'INCOME',
              name: '월급',
              category: INCOME_CATEGORY,
              plannedAmount: lastIncome,
              plannedSource: lastIncome === null ? null : 'LAST_MONTH',
              sortOrder: 0,
            },
            ...fixedExpenses.map((f, index) => ({
              kind: 'FIXED',
              fixedExpenseId: f.id,
              name: f.name,
              category: f.category,
              // 지난달 실제 금액 → 없으면 고정비에 등록한 기본 금액
              plannedAmount: lastByFixedId.get(f.id) ?? f.defaultAmount,
              plannedSource: lastByFixedId.has(f.id) ? 'LAST_MONTH' : 'FIXED_DEFAULT',
              sortOrder: 100 + index,
            })),
          ],
        },
      },
    });

    return { entry: await serializeEntry(entry.id) };
  });

  /**
   * 그 달의 요약. **전원이 제출하지 않아도 열린다.**
   *
   * 예전에는 COMPLETE 가 아니면 409 로 막았는데, 가족 중 한 명이 앱을 안 쓰기 시작하면
   * 그 달부터 아무도 아무것도 못 보게 된다. 잠금을 없애고, 대신 숫자가 몇 명 기준인지를
   * progress 로 같이 내려보낸다. (기획서 3장)
   */
  app.get('/families/:familyId/books/:yearMonth/summary', async (request) => {
    const user = await requireUser(request);
    const params = z.object({ familyId: z.string(), yearMonth: z.string() }).parse(request.params);
    const yearMonth = parseYearMonth(params.yearMonth);
    await requireMembership(user.id, params.familyId);

    return buildMonthSummary(params.familyId, yearMonth);
  });

  /** 장부 상태를 다시 계산한다 (디버깅·복구용) */
  app.post('/families/:familyId/books/:yearMonth/refresh', async (request) => {
    const user = await requireUser(request);
    const params = z.object({ familyId: z.string(), yearMonth: z.string() }).parse(request.params);
    await requireMembership(user.id, params.familyId);

    const book = await getOrCreateBook(params.familyId, parseYearMonth(params.yearMonth));
    return { status: await refreshBookStatus(book.id) };
  });
}
