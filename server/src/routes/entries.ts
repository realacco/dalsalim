import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { prisma } from '../db.js';
import { requireOwnEntry, requireUser } from '../auth.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { CATEGORIES, needsReason } from '../lib/shared.js';
import { serializeEntry } from '../services/entry.js';
import { refreshBookStatus } from '../services/book.js';

const amount = z.number().int().min(0).max(1_000_000_000);
const reason = z.string().trim().max(200).nullable().optional();

/** 제출된 기록은 먼저 되돌린 뒤에 고쳐야 한다. 앱은 [수정하기] 버튼으로 이걸 호출한다. */
function assertDraft(status: string) {
  if (status !== 'DRAFT') {
    throw forbidden('제출한 기록입니다. [수정하기]를 눌러 다시 열어주세요.');
  }
}

export async function entryRoutes(app: FastifyInstance) {
  app.get('/entries/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    await requireOwnEntry(user.id, id);

    return { entry: await serializeEntry(id) };
  });

  /** 특이사항 / 위저드 진행 위치 저장 */
  app.patch('/entries/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const entry = await requireOwnEntry(user.id, id);
    assertDraft(entry.status);

    const body = z
      .object({
        note: z.string().trim().max(1000).nullable().optional(),
        cursor: z.number().int().min(0).max(500).optional(),
      })
      .parse(request.body);

    await prisma.memberEntry.update({ where: { id }, data: body });
    return { entry: await serializeEntry(id) };
  });

  /**
   * 한 스텝의 금액을 확정한다.
   *
   * 이 앱의 규칙이 강제되는 자리:
   * 기본값이 있고 금액이 그와 다르면 사유 없이는 통과시키지 않는다.
   */
  app.patch('/entries/:id/lines/:lineId', async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string(), lineId: z.string() }).parse(request.params);
    const entry = await requireOwnEntry(user.id, params.id);
    assertDraft(entry.status);

    const body = z
      .object({ actualAmount: amount, changeReason: reason, name: z.string().trim().min(1).max(30).optional() })
      .parse(request.body);

    const line = await prisma.entryLine.findUnique({ where: { id: params.lineId } });
    if (!line || line.entryId !== entry.id) throw notFound('입력 줄을 찾을 수 없습니다.');

    const trimmedReason = body.changeReason?.trim() || null;

    if (needsReason(line.plannedAmount, body.actualAmount) && !trimmedReason) {
      throw badRequest(
        'REASON_REQUIRED',
        '금액이 달라졌어요. 이번 달에 왜 이랬는지 한 줄만 적어주세요.',
      );
    }

    const updated = await prisma.entryLine.update({
      where: { id: params.lineId },
      data: {
        actualAmount: body.actualAmount,
        // 금액을 원래대로 되돌렸다면 사유도 같이 지운다
        changeReason: needsReason(line.plannedAmount, body.actualAmount) ? trimmedReason : null,
        ...(body.name && line.kind === 'EXTRA' ? { name: body.name } : {}),
      },
    });

    return { line: updated };
  });

  /** 추가 지출 항목 — 이름부터 받는다 */
  app.post('/entries/:id/lines', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const entry = await requireOwnEntry(user.id, id);
    assertDraft(entry.status);

    const body = z
      .object({
        name: z.string().trim().min(1, '항목 이름을 적어주세요.').max(30),
        category: z.enum(CATEGORIES),
        actualAmount: amount,
      })
      .parse(request.body);

    const count = await prisma.entryLine.count({ where: { entryId: id, kind: 'EXTRA' } });

    const line = await prisma.entryLine.create({
      data: {
        entryId: id,
        kind: 'EXTRA',
        name: body.name,
        category: body.category,
        // 추가 지출은 비교 대상이 없다. 그래서 사유도 묻지 않는다 — 이름이 곧 사유다.
        plannedAmount: null,
        actualAmount: body.actualAmount,
        sortOrder: 1000 + count,
      },
    });

    return { line };
  });

  app.delete('/entries/:id/lines/:lineId', async (request) => {
    const user = await requireUser(request);
    const params = z.object({ id: z.string(), lineId: z.string() }).parse(request.params);
    const entry = await requireOwnEntry(user.id, params.id);
    assertDraft(entry.status);

    const line = await prisma.entryLine.findUnique({ where: { id: params.lineId } });
    if (!line || line.entryId !== entry.id) throw notFound('입력 줄을 찾을 수 없습니다.');
    if (line.kind !== 'EXTRA') throw badRequest('NOT_DELETABLE', '추가 지출 항목만 지울 수 있습니다.');

    await prisma.entryLine.delete({ where: { id: params.lineId } });
    return { ok: true };
  });

  app.post('/entries/:id/submit', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const entry = await requireOwnEntry(user.id, id);
    assertDraft(entry.status);

    const lines = await prisma.entryLine.findMany({
      where: { entryId: id },
      orderBy: { sortOrder: 'asc' },
    });

    // 지나치지 않은 스텝이 남아 있으면 제출을 막는다
    const unfilled = lines.filter((l) => l.kind !== 'EXTRA' && l.actualAmount === null);
    if (unfilled.length > 0) {
      throw badRequest(
        'INCOMPLETE',
        `아직 적지 않은 항목이 있어요: ${unfilled.map((l) => l.name).join(', ')}`,
      );
    }

    const missingReason = lines.filter(
      (l) => needsReason(l.plannedAmount, l.actualAmount) && !l.changeReason,
    );
    if (missingReason.length > 0) {
      throw badRequest(
        'REASON_REQUIRED',
        `사유가 비어 있어요: ${missingReason.map((l) => l.name).join(', ')}`,
      );
    }

    await prisma.memberEntry.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
    });

    const bookStatus = await refreshBookStatus(entry.bookId);
    return { entry: await serializeEntry(id), bookStatus };
  });

  /** 제출한 기록을 다시 연다. 장부가 완성돼 있었다면 다시 '진행 중'으로 내려간다. */
  app.post('/entries/:id/reopen', async (request) => {
    const user = await requireUser(request);
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const entry = await requireOwnEntry(user.id, id);

    await prisma.memberEntry.update({
      where: { id },
      data: { status: 'DRAFT', submittedAt: null },
    });

    const bookStatus = await refreshBookStatus(entry.bookId);
    return { entry: await serializeEntry(id), bookStatus };
  });
}
