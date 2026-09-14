// 기능: F-BOOK-01 F-BOOK-02 F-BOOK-03 F-BOOK-04 F-ENT-11 F-ENT-12
/**
 * 월 장부를 다루는 곳 — 장부 열기 · 홈 뷰 · 기록 시작(프리필) · 요약 · 추이 · 완성 판정.
 *
 * ★ 이 파일은 services/entry 를 임포트하지 않는다. 둘이 서로를 임포트하면 원이 생기고,
 *   나중에 누가 파일 맨 위에서 상대 함수를 쓰는 순간 "함수가 아니다" 오류로 터진다.
 *   둘이 같이 쓰는 순수 계산(entrySummary)은 아래층인 lib/shared 에 있다.
 */
import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import {
  ACTIVE_MEMBER,
  INCOME_CATEGORY,
  bookProgress,
  currentYearMonth,
  entrySummary,
  shiftYearMonth,
} from '../lib/shared.js';

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
      // 스텝 수는 항목 수가 아니라 줄 수로 센다 — 결산 줄은 항목에 없고 지난달 기록에서 온다 (F-ENT-11)
      progress: entry
        ? bookProgress(
            entry.cursor,
            entry.lines.filter((l) => l.kind === 'FIXED' || l.kind === 'SETTLEMENT').length,
          )
        : null,
      /** 고정비가 0개면 이 앱의 템플릿이 비어 있다는 뜻이다. 홈이 그걸 먼저 안내한다. */
      fixedExpenseCount: m.fixedExpenses.length,
      summary: entry?.status === 'SUBMITTED' ? entrySummary(entry.lines) : null,
    };
  });
}

/**
 * 그 달에 제출본이 있는 사람 수 — 홈의 "아래 숫자는 N명 기준" 의 N.
 * 요약의 progress.submittedCount 와 같은 축(구성원 상태를 안 봄)이어야 한다.
 * 홈의 사람별 목록은 현재 구성원만 보이므로 거기서 세면 나간 사람의 제출본이 빠져 요약과 갈린다 (F-BOOK-02).
 */
export function countSubmittedEntries(bookId: string) {
  return prisma.memberEntry.count({ where: { bookId, status: 'SUBMITTED' } });
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

  // 결산 줄도 fixedExpenseId 를 들고 있지만 이번 달 고정비 줄은 아니다 — FIXED 만 "있는 것" 으로 센다
  const existingIds = new Set(
    entry.lines
      .filter((l) => l.kind === 'FIXED' && l.fixedExpenseId)
      .map((l) => l.fixedExpenseId as string),
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

/**
 * 내 기록을 시작하거나 이어서 연다. 만든 기록의 id 를 돌려준다.
 *
 * ★ 프리필 우선순위 (기획서 7.4): 지난달에 내가 실제로 적은 금액 → 없으면 고정비에 등록한 기본 금액.
 *   EntryLine 의 name·category 는 FixedExpense 에서 **복사**한다 (하드룰 4) — 항목 이름을 바꿔도
 *   과거 기록이 흔들리면 안 된다. fixedExpenseId 는 참조로 남긴다.
 *
 * ★ 결산 줄 (F-ENT-11): 지난달 고정비 줄 가운데 항목의 결산 스위치가 켜진 것마다 한 줄씩,
 *   "그 돈을 실제로 얼마나 썼나" 를 묻는다. 이름·분류는 **지난달 줄**에서 복사한다 — 항목이 아니라
 *   지난달 기록의 정정이므로, 그 사이 항목 이름이 바뀌었거나 항목이 지워졌어도 지난달 그 이름으로 묻는다.
 *   기록을 처음 만들 때만 붙인다 (정의서: "스위치는 이번 달 기록을 만드는 시점에 읽는다").
 *   syncFixedLines 가 붙이지 않는 이유는 적는 중인 기록의 맨 앞에 스텝이 끼어들면 cursor 가 밀려
 *   "다음에 열었더니 다른 질문이 나온다" 가 되기 때문이다. 스위치를 나중에 켠 경우뿐 아니라
 *   이번 달을 먼저 열어두고 지난달을 나중에 마무리한 경우도 같다 — 그때는 이번 달 초안을 지우고
 *   다시 열면 묻고(F-ENT-10), 아니면 다음 달부터 묻는다.
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
    orderBy: { sortOrder: 'asc' },
    // 결산은 지금 스위치가 켜져 있는지로 정한다. 지운 항목(active=false)도 스위치가 켜져 있었으면 묻는다 —
    // 옮겨둔 돈을 얼마나 썼는지는 항목을 지웠다고 없어지는 사실이 아니다
    include: { fixedExpense: { select: { settles: true } } },
  });
  // 제출 여부는 보지 않는다 — 프리필과 같은 정책이다. 그래서 지난달이 아직 초안인 채로 이번 달을 열면
  // 결산 줄의 "옮긴 금액"은 그 시점의 값으로 굳고, 지난달 초안을 나중에 고쳐도 따라가지 않는다.
  // 의도한 것이다: 결산 줄도 만드는 시점의 스냅샷이고(하드룰 4), 지난달을 고치고 나서 이번 달 초안을
  // 지우고 다시 열면(F-ENT-10) 새 금액으로 묻는다.

  // 월급 줄만 본다. 지난달 기타 수입(EXTRA_INCOME)이 이번 달 월급의 기본값이 되면 안 된다 (F-ENT-12)
  const lastIncome = lastMonthLines.find((l) => l.kind === 'INCOME')?.actualAmount ?? null;
  const lastByFixedId = new Map(
    lastMonthLines
      // 금액이 비어 있는 줄은 기본값의 근거가 될 수 없다.
      // 제출 여부는 보지 않는다 — 지난달에 적다 만 초안의 금액도 근거가 된다.
      .filter((l) => l.kind === 'FIXED' && l.fixedExpenseId && l.actualAmount !== null)
      .map((l) => [l.fixedExpenseId as string, l.actualAmount as number]),
  );

  // 0 원을 옮겨둔 달은 물을 게 없다 — "0 원 중에 얼마나 썼나요" 는 질문이 아니다
  const settlementSources = lastMonthLines.filter(
    (l) =>
      l.kind === 'FIXED' &&
      l.fixedExpense?.settles === true &&
      l.actualAmount !== null &&
      l.actualAmount > 0,
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
          // 결산 줄은 수입(0)보다 앞에 온다 — 지난달 이야기를 먼저 끝내고 이번 달로 넘어간다.
          // 음수를 뒤에서부터 매겨서(-n … -1) 개수가 몇이든 0 과 겹치지 않는다
          ...settlementSources.map((l, index) => ({
            kind: 'SETTLEMENT',
            fixedExpenseId: l.fixedExpenseId,
            name: l.name,
            category: l.category,
            plannedAmount: l.actualAmount,
            plannedSource: 'LAST_MONTH',
            sortOrder: index - settlementSources.length,
          })),
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
  const submittedIds = new Set(submitted.map((entry) => entry.membershipId));

  // ★ 집계의 축은 구성원 상태가 아니라 그 달의 제출본이다 (하드룰 6 · F-FAM-08).
  //   나간 사람의 제출본을 빼면 그 사람이 나가는 순간 지난달 합계가 줄어든다 — 실제 삭제와 같은 결과다.
  //   사람별 = 그 달에 제출본이 있는 사람 전부 + 현재 구성원 중 미제출자. 그래야 사람별 합이 총계다.
  //   "제출본이 있는 사람"에는 나간 사람(LEFT)뿐 아니라 나갔다가 다시 신청해 대기 중인 사람(PENDING)도 든다.
  //   하드룰 8 은 PENDING 을 정원에서 빼라고 하지만 그건 아직 한 줄도 안 낸 사람 얘기다 — 이 제출본은
  //   ACTIVE 이던 달의 기록이라 빼면 하드룰 6 이 깨지고 제출 수가 정원을 넘는다. 여기서는 6 이 이긴다.
  const perMember = [
    ...submitted.map((entry) => ({
      sortOrder: entry.membership.sortOrder,
      membershipId: entry.membershipId,
      displayName: entry.membership.displayName,
      submitted: true,
      note: entry.note,
      ...entrySummary(entry.lines),
    })),
    ...memberships
      .filter((membership) => !submittedIds.has(membership.id))
      .map((membership) => ({
        sortOrder: membership.sortOrder,
        membershipId: membership.id,
        displayName: membership.displayName,
        submitted: false,
        note: null,
        ...entrySummary([]),
      })),
  ]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _order, ...row }) => row);

  const allLines = submitted.flatMap((entry) =>
    entry.lines.map((line) => ({ ...line, displayName: entry.membership.displayName })),
  );

  const income = perMember.reduce((sum, m) => sum + m.income, 0);
  const extraIncomeTotal = perMember.reduce((sum, m) => sum + m.extraIncomeTotal, 0);
  const fixedTotal = perMember.reduce((sum, m) => sum + m.fixedTotal, 0);
  const extraTotal = perMember.reduce((sum, m) => sum + m.extraTotal, 0);
  const settlementTotal = perMember.reduce((sum, m) => sum + m.settlementTotal, 0);

  // 카테고리별 합계 (수입 제외 — 기타 수입도 수입이다). 결산 줄도 뺀다 — 그 돈은 지난달 고정비로 이미 이 표에 들어갔다 (F-ENT-11)
  const byCategory = new Map<string, number>();
  for (const line of allLines) {
    if (line.kind === 'INCOME' || line.kind === 'EXTRA_INCOME' || line.kind === 'SETTLEMENT')
      continue;
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
      // 정원 = 현재 구성원 + 그 달에 제출본이 있는 비활성(LEFT·PENDING) 사람.
      // "N명 기준"의 N 이 숫자에 들어간 사람 수와 같아야 한다
      memberCount: perMember.length,
      pendingMembers: perMember
        .filter((m) => !m.submitted)
        .map((m) => ({ membershipId: m.membershipId, displayName: m.displayName })),
    },
    totals: {
      income,
      extraIncomeTotal,
      fixedTotal,
      extraTotal,
      settlementTotal,
      surplus: income - fixedTotal - extraTotal - settlementTotal,
    },
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
    // 기타 수입 — 월급 말고 그 달만 들어온 돈. 사유가 없는 줄이라 changes 에는 안 들어간다 (F-ENT-12)
    extraIncomes: allLines
      .filter((l) => l.kind === 'EXTRA_INCOME')
      .map((l) => ({ displayName: l.displayName, name: l.name, amount: l.actualAmount ?? 0 }))
      .sort((a, b) => b.amount - a.amount),
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
    // "지난달 결산" — 옮겨둔 돈을 실제로 얼마나 썼나. 사유가 없는 줄이라 changes 에는 안 들어간다 (F-ENT-11)
    settlements: allLines
      .filter((l) => l.kind === 'SETTLEMENT')
      .map((l) => ({
        displayName: l.displayName,
        name: l.name,
        planned: l.plannedAmount ?? 0,
        actual: l.actualAmount ?? 0,
        // 더 쓴 만큼은 따로 안 싣는다 — max(0, delta) 로 나오고 합계는 totals.settlementTotal 에 있다
        delta: (l.actualAmount ?? 0) - (l.plannedAmount ?? 0),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
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
  const [activeMembers, books] = await Promise.all([
    prisma.membership.findMany({ where: { familyId, ...ACTIVE_MEMBER }, select: { id: true } }),
    prisma.monthlyBook.findMany({
      where: { familyId },
      orderBy: { yearMonth: 'desc' },
      take: months,
      include: {
        // 나간 사람의 제출본도 센다 — 요약과 같은 축이다 (하드룰 6 · F-FAM-08). 빼면 나가는 순간 과거 점이 내려앉는다
        entries: { where: { status: 'SUBMITTED' }, include: { lines: true } },
      },
    }),
  ]);
  const activeIds = new Set(activeMembers.map((m) => m.id));

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
            settlementTotal: acc.settlementTotal + s.settlementTotal,
          };
        },
        { income: 0, fixedTotal: 0, extraTotal: 0, settlementTotal: 0 },
      );

      return {
        yearMonth: book.yearMonth,
        ...totals,
        surplus: totals.income - totals.fixedTotal - totals.extraTotal - totals.settlementTotal,
        submittedCount: book.entries.length,
        // 정원 = 현재 구성원 + 그 달에 제출본이 있는 비활성 사람 (요약의 memberCount 와 같은 규칙 — 위 주석)
        memberCount:
          activeIds.size + book.entries.filter((e) => !activeIds.has(e.membershipId)).length,
      };
    })
    .reverse(); // 오래된 달이 왼쪽에 오게
}
