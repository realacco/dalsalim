import { prisma } from '../lib/db.js';
import { notFound } from '../lib/http.js';
import { entrySummary } from './entry.js';

/**
 * 장부 상태를 다시 계산한다.
 *
 * 전원 제출 여부를 COMPLETE 표시로 계산하는 단 하나의 지점이다.
 * 제출·재작성 어느 쪽이든 이 함수를 통과한다.
 *
 * 이 상태는 표시일 뿐 잠금장치가 아니다 — 요약은 미제출자가 있어도 열린다. (기획서 3장)
 * 멤버가 나중에 합류하면 그 사람 몫이 비므로 장부는 다시 열린다. 의도된 동작이다.
 */
export async function refreshBookStatus(bookId: string): Promise<'OPEN' | 'COMPLETE'> {
  const book = await prisma.monthlyBook.findUniqueOrThrow({
    where: { id: bookId },
    include: { entries: true, family: { include: { memberships: true } } },
  });

  const memberCount = book.family.memberships.length;
  const submitted = book.entries.filter((e) => e.status === 'SUBMITTED').length;
  const complete = memberCount > 0 && submitted === memberCount;

  if (complete === (book.status === 'COMPLETE')) {
    return book.status as 'OPEN' | 'COMPLETE';
  }

  await prisma.monthlyBook.update({
    where: { id: bookId },
    data: {
      status: complete ? 'COMPLETE' : 'OPEN',
      completedAt: complete ? new Date() : null,
    },
  });

  return complete ? 'COMPLETE' : 'OPEN';
}

/**
 * 그 달의 요약 한 벌.
 *
 * 라우트가 아니라 여기 있는 이유: 추이(trend)가 같은 집계를 쓴다.
 * 두 곳이 같은 계산을 하기 시작하면 그 계산은 서비스로 내려와야 한다.
 */
export async function buildMonthSummary(familyId: string, yearMonth: string) {
  const book = await prisma.monthlyBook.findUnique({
    where: { familyId_yearMonth: { familyId, yearMonth } },
    include: {
      entries: { include: { lines: { orderBy: { sortOrder: 'asc' } }, membership: true } },
    },
  });

  if (!book) throw notFound('그 달의 장부가 없습니다.');

  const perMember = book.entries.map((entry) => ({
    membershipId: entry.membershipId,
    displayName: entry.membership.displayName,
    note: entry.note,
    ...entrySummary(entry.lines),
  }));

  const allLines = book.entries.flatMap((entry) =>
    entry.lines.map((line) => ({ ...line, displayName: entry.membership.displayName })),
  );

  const income = perMember.reduce((sum, m) => sum + m.income, 0);
  const fixedTotal = perMember.reduce((sum, m) => sum + m.fixedTotal, 0);
  const extraTotal = perMember.reduce((sum, m) => sum + m.extraTotal, 0);

  // 카테고리별 합계 (수입 제외)
  const byCategory = new Map<string, number>();
  for (const line of allLines) {
    if (line.kind === 'INCOME') continue;
    byCategory.set(line.category, (byCategory.get(line.category) ?? 0) + (line.actualAmount ?? 0));
  }

  return {
    book: { id: book.id, yearMonth: book.yearMonth, status: book.status },
    totals: { income, fixedTotal, extraTotal, surplus: income - fixedTotal - extraTotal },
    perMember,
    // "이번 달 달라진 것" — 이 앱이 다른 가계부와 갈라지는 지점
    changes: allLines
      .filter((l) => l.changeReason && l.plannedAmount !== null)
      .map((l) => ({
        displayName: l.displayName,
        name: l.name,
        kind: l.kind,
        delta: (l.actualAmount ?? 0) - (l.plannedAmount ?? 0),
        reason: l.changeReason as string,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    extras: allLines
      .filter((l) => l.kind === 'EXTRA')
      .map((l) => ({
        displayName: l.displayName,
        name: l.name,
        category: l.category,
        amount: l.actualAmount ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount),
    byCategory: [...byCategory.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    notes: perMember
      .filter((m) => m.note)
      .map((m) => ({ displayName: m.displayName, note: m.note as string })),
  };
}
