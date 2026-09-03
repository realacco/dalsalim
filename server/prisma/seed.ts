/**
 * 데모 데이터.
 *
 * 기획서 10장의 성공 기준 5번("두 번째 달부터는 지난달 값이 기본으로 깔린다")을
 * 첫 실행부터 확인할 수 있게, **지난달 기록이 이미 제출된 상태**로 만들어 둔다.
 *
 *   npm run seed
 *   → 개발용 로그인에서 '아빠' / '엄마' 로 들어가면 그 가족에 이미 들어가 있다
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CODE = 'DEMO01';

function shift(yearMonth: string, months: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const zero = y * 12 + (m - 1) + months;
  return `${Math.floor(zero / 12)}-${String((zero % 12) + 1).padStart(2, '0')}`;
}

const now = new Date();
const THIS_MONTH = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const LAST_MONTH = shift(THIS_MONTH, -1);

type Spec = {
  name: string;
  income: number;
  fixed: {
    name: string;
    category: string;
    amount: number;
    day?: number;
    lastMonth?: number;
    reason?: string;
  }[];
  extras: { name: string; category: string; amount: number }[];
  note: string;
};

const PEOPLE: Spec[] = [
  {
    name: '아빠',
    income: 3_450_000,
    fixed: [
      { name: '월세', category: '주거', amount: 800_000, day: 1 },
      {
        name: '관리비',
        category: '주거',
        amount: 180_000,
        day: 20,
        lastMonth: 240_000,
        reason: '에어컨을 많이 틀었다',
      },
      { name: '통신비', category: '통신', amount: 55_000, day: 25 },
      { name: '자동차보험', category: '보험', amount: 83_000, day: 5 },
    ],
    extras: [{ name: '형 결혼식 축의금', category: '기타', amount: 300_000 }],
    note: '에어컨을 많이 틀어서 관리비가 올랐다. 다음 달엔 좀 줄여보자.',
  },
  {
    name: '엄마',
    income: 1_200_000,
    fixed: [
      { name: '통신비', category: '통신', amount: 43_000, day: 25 },
      { name: '실비보험', category: '보험', amount: 62_000, day: 15 },
      { name: '넷플릭스', category: '구독', amount: 17_000, day: 8 },
    ],
    extras: [{ name: '아이 학원비', category: '교육', amount: 350_000 }],
    note: '',
  },
];

async function main() {
  const existing = await prisma.family.findUnique({ where: { inviteCode: CODE } });
  if (existing) {
    console.log(
      `이미 데모 가족이 있습니다 (초대코드 ${CODE}). 다시 만들려면 npm run db:reset 후 실행하세요.`,
    );
    return;
  }

  const family = await prisma.family.create({ data: { name: '김씨네', inviteCode: CODE } });

  const book = await prisma.monthlyBook.create({
    data: {
      familyId: family.id,
      yearMonth: LAST_MONTH,
      status: 'COMPLETE',
      completedAt: new Date(),
    },
  });

  for (const [index, person] of PEOPLE.entries()) {
    const user = await prisma.user.create({
      data: { devKey: `dev:${person.name}`, nickname: person.name },
    });

    const membership = await prisma.membership.create({
      data: {
        familyId: family.id,
        userId: user.id,
        displayName: person.name,
        role: index === 0 ? 'OWNER' : 'MEMBER',
        sortOrder: index,
      },
    });

    const fixedExpenses: { id: string }[] = [];
    for (const [order, spec] of person.fixed.entries()) {
      fixedExpenses.push(
        await prisma.fixedExpense.create({
          data: {
            familyId: family.id,
            membershipId: membership.id,
            name: spec.name,
            category: spec.category,
            defaultAmount: spec.amount,
            dayOfMonth: spec.day ?? null,
            sortOrder: order,
          },
        }),
      );
    }

    // 지난달 기록 — 제출 완료 상태
    await prisma.memberEntry.create({
      data: {
        bookId: book.id,
        membershipId: membership.id,
        status: 'SUBMITTED',
        submittedAt: new Date(),
        note: person.note || null,
        cursor: person.fixed.length + 3,
        lines: {
          create: [
            {
              kind: 'INCOME',
              name: '월급',
              category: '수입',
              plannedAmount: null,
              actualAmount: person.income,
              sortOrder: 0,
            },
            ...person.fixed.map((spec, order) => ({
              kind: 'FIXED',
              fixedExpenseId: fixedExpenses[order].id,
              name: spec.name,
              category: spec.category,
              plannedAmount: spec.amount,
              actualAmount: spec.lastMonth ?? spec.amount,
              changeReason: spec.lastMonth ? (spec.reason ?? null) : null,
              sortOrder: 100 + order,
            })),
            ...person.extras.map((spec, order) => ({
              kind: 'EXTRA',
              name: spec.name,
              category: spec.category,
              plannedAmount: null,
              actualAmount: spec.amount,
              sortOrder: 1000 + order,
            })),
          ],
        },
      },
    });
  }

  console.log(`데모 가족 '김씨네' 생성 완료`);
  console.log(`  초대코드    ${CODE}`);
  console.log(`  지난달      ${LAST_MONTH} (제출 완료 — 이번 달 기본값의 근거)`);
  console.log(`  이번 달     ${THIS_MONTH} (비어 있음 — 여기서부터 적어보면 된다)`);
  console.log(`  개발 로그인 '아빠' 또는 '엄마'`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
