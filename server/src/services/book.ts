import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import { ACTIVE_MEMBER, bookProgress, currentYearMonth, shiftYearMonth } from '../lib/shared.js';
import { entrySummary, syncFixedLines } from './entry.js';

const INCOME_CATEGORY = '수입';

/**
 * 월 장부는 필요할 때 만든다. 미래의 달은 만들지 않는다 —
 * 아직 오지 않은 달의 장부를 열어두면 "이 달은 아무도 안 적었다"는 잘못된 신호가 된다.
 */
export async function getOrCreateBook(familyId: string, yearMonth: string) {
  const existing = await prisma.monthlyBook.findUnique({
    where: { familyId_yearMonth: { familyId, yearMonth } },
  });
  if (existing) return existing;

  if (yearMonth > currentYearMonth()) throw fail('FUTURE_MONTH');

  return prisma.monthlyBook.create({ data: { familyId, yearMonth } });
}

/** 홈 화면의 사람별 진행 현황 — 구성원은 ACTIVE 만 (하드룰 8) */
export async function buildBookView(familyId: string, bookId: string, myMembershipId: string) {
  const members = await prisma.membership.findMany({
    where: { familyId, ...ACTIVE_MEMBER },
    orderBy: { sortOrder: 'asc' },
    include: {
      entries: { where: { bookId }, include: { lines: true } },
      fixedExpenses: { where: { active: true } },
    },
  });

  return members.map((m) => {
    const entry = m.entries[0] ?? null;
    return {
      membershipId: m.id,
      displayName: m.displayName,
      isMe: m.id === myMembershipId,
      entryId: entry?.id ?? null,
      status: entry?.status ?? 'NONE',
      progress: entry ? bookProgress(entry.cursor, m.fixedExpenses.length) : null,
      /** 고정비가 0개면 이 앱의 템플릿이 비어 있다는 뜻이다. 홈이 그걸 먼저 안내한다. */
      fixedExpenseCount: m.fixedExpenses.length,
      summary: entry?.status === 'SUBMITTED' ? entrySummary(entry.lines) : null,
    };
  });
}

/**
 * 내 기록을 시작하거나 이어서 연다. 만든 기록의 id 를 돌려준다.
 *
 * ★ 프리필 우선순위 (기획서 7.4): 지난달에 내가 실제로 적은 금액 → 없으면 고정비에 등록한 기본 금액.
 *   EntryLine 의 name·category 는 FixedExpense 에서 **복사**한다 (하드룰 4) — 항목 이름을 바꿔도
 *   과거 기록이 흔들리면 안 된다. fixedExpenseId 는 참조로 남긴다.
 */
export async function openMyEntry(familyId: string, yearMonth: string, membershipId: string) {
  const book = await getOrCreateBook(familyId, yearMonth);

  const existing = await prisma.memberEntry.findUnique({
    where: { bookId_membershipId: { bookId: book.id, membershipId } },
  });
  if (existing) {
    // 기록을 시작한 뒤에 고정비를 추가했을 수 있다. 작성 중이면 맞춰준다.
    await syncFixedLines(existing.id, membershipId, familyId, yearMonth);
    return existing.id;
  }

  const previous = shiftYearMonth(yearMonth, -1);
  const lastMonthLines = await prisma.entryLine.findMany({
    where: { entry: { membershipId, book: { familyId, yearMonth: previous } } },
  });

  const lastIncome = lastMonthLines.find((l) => l.kind === 'INCOME')?.actualAmount ?? null;
  const lastByFixedId = new Map(
    lastMonthLines
      // 금액이 비어 있는 줄(제출하지 않은 초안)은 기본값의 근거가 될 수 없다
      .filter((l) => l.kind === 'FIXED' && l.fixedExpenseId && l.actualAmount !== null)
      .map((l) => [l.fixedExpenseId as string, l.actualAmount as number]),
  );

  const fixedExpenses = await prisma.fixedExpense.findMany({
    where: { membershipId, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const entry = await prisma.memberEntry.create({
    data: {
      bookId: book.id,
      membershipId,
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
            plannedAmount: lastByFixedId.get(f.id) ?? f.defaultAmount,
            plannedSource: lastByFixedId.has(f.id) ? 'LAST_MONTH' : 'FIXED_DEFAULT',
            sortOrder: 100 + index,
          })),
        ],
      },
    },
  });

  return entry.id;
}

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
    include: {
      entries: true,
      // 나간 사람을 세면 정원이 안 차서 장부가 영원히 진행 중으로 남는다
      family: { include: { memberships: { where: ACTIVE_MEMBER } } },
    },
  });

  // 나간 사람의 기록은 장부에 그대로 남아 있다(과거를 지우지 않으므로).
  // 정원에서만 빠지고 제출 수에는 남으면 submitted > memberCount 가 되어 영원히 안 닫힌다.
  // 양쪽 다 현재 구성원 기준으로 세야 한다.
  const activeIds = new Set(book.family.memberships.map((m) => m.id));
  const memberCount = activeIds.size;
  const submitted = book.entries.filter(
    (e) => e.status === 'SUBMITTED' && activeIds.has(e.membershipId),
  ).length;
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
    prisma.membership.findMany({
      where: { familyId, ...ACTIVE_MEMBER },
      orderBy: { sortOrder: 'asc' },
    }),
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

/**
 * 월별 추이. 요약과 **같은 집계 규칙**을 쓴다 — 제출된 기록만 센다.
 *
 * 기록이 없는 달은 배열에서 뺀다. 0원으로 채우면 "그 달은 한 푼도 안 썼다"는
 * 거짓 그래프가 된다. 없는 건 없는 대로 두는 게 맞다.
 */
export async function buildTrend(familyId: string, months: number) {
  const memberCount = await prisma.membership.count({ where: { familyId, ...ACTIVE_MEMBER } });

  const books = await prisma.monthlyBook.findMany({
    where: { familyId },
    orderBy: { yearMonth: 'desc' },
    take: months,
    include: {
      entries: {
        where: { status: 'SUBMITTED', membership: ACTIVE_MEMBER },
        include: { lines: true },
      },
    },
  });

  return books
    .filter((book) => book.entries.length > 0)
    .map((book) => {
      const totals = book.entries.reduce(
        (acc, entry) => {
          const s = entrySummary(entry.lines);
          return {
            income: acc.income + s.income,
            fixedTotal: acc.fixedTotal + s.fixedTotal,
            extraTotal: acc.extraTotal + s.extraTotal,
          };
        },
        { income: 0, fixedTotal: 0, extraTotal: 0 },
      );

      return {
        yearMonth: book.yearMonth,
        ...totals,
        surplus: totals.income - totals.fixedTotal - totals.extraTotal,
        submittedCount: book.entries.length,
        memberCount,
      };
    })
    .reverse(); // 오래된 달이 왼쪽에 오게
}
