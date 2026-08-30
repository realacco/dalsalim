import { prisma } from '../lib/db.js';
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
 *
 * ★ 집계에 넣는 것은 **제출된 기록뿐**이다.
 * 작성 중(DRAFT)인 사람의 줄은 actualAmount 가 null 이고, 그걸 0원으로 세면
 * "엄마가 수입 0원"처럼 읽히는 거짓 숫자가 나온다. 미제출자는 숫자에서 빼고
 * progress 로만 알린다 — 요약은 누가 안 적었어도 열려야 하기 때문이다. (기획서 3장)
 *
 * 장부가 아직 없는 달도 404 가 아니라 빈 요약을 돌려준다. 추이에서 과거 달을
 * 눌렀을 때 에러 화면이 뜨면 안 된다.
 */
export async function buildMonthSummary(familyId: string, yearMonth: string) {
  const [book, memberships] = await Promise.all([
    prisma.monthlyBook.findUnique({
      where: { familyId_yearMonth: { familyId, yearMonth } },
      include: {
        entries: { include: { lines: { orderBy: { sortOrder: 'asc' } }, membership: true } },
      },
    }),
    prisma.membership.findMany({ where: { familyId }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const submitted = (book?.entries ?? []).filter((entry) => entry.status === 'SUBMITTED');
  const submittedByMembership = new Map(submitted.map((entry) => [entry.membershipId, entry]));

  const perMember = memberships.map((membership) => {
    const entry = submittedByMembership.get(membership.id);
    return {
      membershipId: membership.id,
      displayName: membership.displayName,
      submitted: Boolean(entry),
      note: entry?.note ?? null,
      ...entrySummary(entry?.lines ?? []),
    };
  });

  const allLines = submitted.flatMap((entry) =>
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
    book: {
      id: book?.id ?? null,
      yearMonth,
      status: book?.status ?? 'OPEN',
    },
    /** 숫자가 몇 명 기준인지 — 앱이 "엄마가 아직 안 적었어요" 배너를 그리는 근거 */
    progress: {
      submittedCount: submitted.length,
      memberCount: memberships.length,
      pendingMembers: perMember
        .filter((m) => !m.submitted)
        .map((m) => ({ membershipId: m.membershipId, displayName: m.displayName })),
    },
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
