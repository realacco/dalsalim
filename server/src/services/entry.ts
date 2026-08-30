import type { EntryLine } from '@prisma/client';

import { prisma } from '../db.js';
import { shiftYearMonth } from '../lib/shared.js';

/** 위저드가 들고 다니는 기록 한 벌 */
export async function serializeEntry(entryId: string) {
  const entry = await prisma.memberEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: {
      lines: { orderBy: { sortOrder: 'asc' } },
      book: true,
      membership: true,
    },
  });

  return {
    id: entry.id,
    bookId: entry.bookId,
    yearMonth: entry.book.yearMonth,
    membershipId: entry.membershipId,
    displayName: entry.membership.displayName,
    status: entry.status,
    note: entry.note,
    cursor: entry.cursor,
    lines: entry.lines.map((line) => ({
      id: line.id,
      kind: line.kind,
      fixedExpenseId: line.fixedExpenseId,
      name: line.name,
      category: line.category,
      plannedAmount: line.plannedAmount,
      plannedSource: line.plannedSource,
      actualAmount: line.actualAmount,
      changeReason: line.changeReason,
    })),
    summary: entrySummary(entry.lines),
  };
}

export function entrySummary(lines: Pick<EntryLine, 'kind' | 'actualAmount'>[]) {
  let income = 0;
  let fixedTotal = 0;
  let extraTotal = 0;

  for (const line of lines) {
    const amount = line.actualAmount ?? 0;
    if (line.kind === 'INCOME') income += amount;
    else if (line.kind === 'FIXED') fixedTotal += amount;
    else extraTotal += amount;
  }

  return { income, fixedTotal, extraTotal, surplus: income - fixedTotal - extraTotal };
}

/**
 * 기록을 시작한 뒤에 고정비 항목이 추가됐다면 줄을 채워 넣는다.
 * 삭제된 항목의 줄은 지우지 않는다 — 이미 금액을 적었을 수 있고,
 * 그 달에 실제로 나간 돈이라는 사실은 항목을 지운다고 사라지지 않는다.
 */
export async function syncFixedLines(
  entryId: string,
  membershipId: string,
  familyId: string,
  yearMonth: string,
) {
  const entry = await prisma.memberEntry.findUniqueOrThrow({
    where: { id: entryId },
    include: { lines: true },
  });

  if (entry.status !== 'DRAFT') return;

  const existingIds = new Set(
    entry.lines.filter((l) => l.fixedExpenseId).map((l) => l.fixedExpenseId as string),
  );

  const missing = await prisma.fixedExpense.findMany({
    where: { membershipId, active: true, id: { notIn: [...existingIds] } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  if (missing.length === 0) return;

  const previous = shiftYearMonth(yearMonth, -1);
  const lastMonthLines = await prisma.entryLine.findMany({
    where: {
      kind: 'FIXED',
      fixedExpenseId: { in: missing.map((f) => f.id) },
      entry: { membershipId, book: { familyId, yearMonth: previous } },
    },
  });
  const lastByFixedId = new Map(
    lastMonthLines
      .filter((l) => l.actualAmount !== null)
      .map((l) => [l.fixedExpenseId as string, l.actualAmount as number]),
  );

  // 추가 지출(1000번대)보다 앞에 오도록 100번대 뒤에 붙인다
  const maxFixedOrder = entry.lines
    .filter((l) => l.kind === 'FIXED')
    .reduce((max, l) => Math.max(max, l.sortOrder), 99);

  await prisma.entryLine.createMany({
    data: missing.map((f, index) => ({
      entryId,
      kind: 'FIXED',
      fixedExpenseId: f.id,
      name: f.name,
      category: f.category,
      plannedAmount: lastByFixedId.get(f.id) ?? f.defaultAmount,
      plannedSource: lastByFixedId.has(f.id) ? 'LAST_MONTH' : 'FIXED_DEFAULT',
      sortOrder: maxFixedOrder + 1 + index,
    })),
  });
}
