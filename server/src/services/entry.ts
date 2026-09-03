import type { MemberEntry } from '@prisma/client';

import { prisma } from '../lib/db.js';
import { fail } from '../lib/http.js';
import { entrySummary, needsReason } from '../lib/shared.js';
import { refreshBookStatus } from './book.js';

/**
 * 기록 한 벌을 다루는 곳 — 줄 저장 · 추가 지출 · 제출 · 되돌리기.
 *
 * 이 파일은 book 을 임포트하지만 그 반대는 없다. 부분(기록)이 끝나면 전체(장부)에
 * 알리는 한 방향이다 — 제출하면 "전원이 냈나"를 다시 세야 하기 때문이다.
 */

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

/** 제출된 기록은 먼저 되돌린 뒤에 고쳐야 한다. 앱은 [수정하기] 버튼으로 reopen 을 부른다. */
export function assertDraft(entry: Pick<MemberEntry, 'status'>) {
  if (entry.status !== 'DRAFT') throw fail('ENTRY_SUBMITTED');
}

/** 특이사항 · 위저드 진행 위치 */
export function updateEntryMeta(entryId: string, data: { note?: string | null; cursor?: number }) {
  return prisma.memberEntry.update({ where: { id: entryId }, data });
}

async function findLine(entryId: string, lineId: string) {
  const line = await prisma.entryLine.findUnique({ where: { id: lineId } });
  if (!line || line.entryId !== entryId) throw fail('LINE_NOT_FOUND');
  return line;
}

/**
 * 한 스텝의 금액을 확정한다.
 *
 * ★ 하드룰 2·3 이 강제되는 자리 — 기본값이 있고 금액이 그와 다르면 사유 없이는 통과시키지 않는다.
 *   판정은 lib/shared 의 needsReason() 한 곳에서만 한다. 제출(submitEntry)에서 한 번 더 막는다.
 */
export async function updateLine(
  entryId: string,
  lineId: string,
  body: { actualAmount: number; changeReason?: string | null; name?: string },
) {
  const line = await findLine(entryId, lineId);
  const trimmedReason = body.changeReason?.trim() || null;
  const reasonNeeded = needsReason(line.plannedAmount, body.actualAmount);

  if (reasonNeeded && !trimmedReason) throw fail('REASON_REQUIRED');

  return prisma.entryLine.update({
    where: { id: lineId },
    data: {
      actualAmount: body.actualAmount,
      // 금액을 원래대로 되돌렸다면 사유도 같이 지운다 (하드룰 2)
      changeReason: reasonNeeded ? trimmedReason : null,
      ...(body.name && line.kind === 'EXTRA' ? { name: body.name } : {}),
    },
  });
}

/** 추가 지출 항목 — 비교 대상이 없으므로 사유도 묻지 않는다. 이름이 곧 사유다. */
export async function addExtraLine(
  entryId: string,
  body: { name: string; category: string; actualAmount: number },
) {
  const count = await prisma.entryLine.count({ where: { entryId, kind: 'EXTRA' } });

  return prisma.entryLine.create({
    data: {
      entryId,
      kind: 'EXTRA',
      name: body.name,
      category: body.category,
      plannedAmount: null,
      actualAmount: body.actualAmount,
      // 추가 지출은 1000번대 — 고정비(100번대) 뒤에 온다
      sortOrder: 1000 + count,
    },
  });
}

/** 추가 지출만 지울 수 있다. 수입·고정비 줄은 템플릿이라 비울 수는 있어도 없앨 수는 없다. */
export async function deleteExtraLine(entryId: string, lineId: string) {
  const line = await findLine(entryId, lineId);
  if (line.kind !== 'EXTRA') throw fail('NOT_DELETABLE');
  await prisma.entryLine.delete({ where: { id: lineId } });
}

/**
 * 제출. 안 적은 스텝이 있거나 사유가 빈 줄이 있으면 막는다 (하드룰 3 의 두 번째 방어선).
 * 제출되면 장부의 완성 판정을 다시 한다.
 */
export async function submitEntry(entry: Pick<MemberEntry, 'id' | 'bookId'>) {
  const lines = await prisma.entryLine.findMany({
    where: { entryId: entry.id },
    orderBy: { sortOrder: 'asc' },
  });

  const unfilled = lines.filter((l) => l.kind !== 'EXTRA' && l.actualAmount === null);
  if (unfilled.length > 0) {
    throw fail('INCOMPLETE', unfilled.map((l) => l.name).join(', '));
  }

  const missingReason = lines.filter(
    (l) => needsReason(l.plannedAmount, l.actualAmount) && !l.changeReason,
  );
  if (missingReason.length > 0) {
    throw fail('REASON_REQUIRED', missingReason.map((l) => l.name).join(', '));
  }

  await prisma.memberEntry.update({
    where: { id: entry.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  });

  return refreshBookStatus(entry.bookId);
}

/** 제출한 기록을 다시 연다. 장부가 완성돼 있었다면 다시 '진행 중'으로 내려간다. */
export async function reopenEntry(entry: Pick<MemberEntry, 'id' | 'bookId'>) {
  await prisma.memberEntry.update({
    where: { id: entry.id },
    data: { status: 'DRAFT', submittedAt: null },
  });

  return refreshBookStatus(entry.bookId);
}
