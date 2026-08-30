import { prisma } from '../db.js';

/**
 * 장부 상태를 다시 계산한다.
 *
 * "가족이 모두 등록해야 그 달이 완성된다"는 계약을 강제하는 단 하나의 지점이다.
 * 제출·재작성 어느 쪽이든 이 함수를 통과한다.
 *
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
