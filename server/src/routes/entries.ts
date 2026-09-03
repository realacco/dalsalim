import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireOwnEntry, requireUser } from '../lib/auth.js';
import { amount, category } from '../lib/schemas.js';
import {
  addExtraLine,
  assertDraft,
  deleteExtraLine,
  reopenEntry,
  serializeEntry,
  submitEntry,
  updateEntryMeta,
  updateLine,
} from '../services/entry.js';

const reason = z.string().trim().max(200).nullable().optional();
const entryParams = z.object({ id: z.string() });
const lineParams = z.object({ id: z.string(), lineId: z.string() });

export async function entryRoutes(app: FastifyInstance) {
  app.get('/entries/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = entryParams.parse(request.params);
    await requireOwnEntry(user.id, id);

    return { entry: await serializeEntry(id) };
  });

  /** 특이사항 / 위저드 진행 위치 저장 */
  app.patch('/entries/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = entryParams.parse(request.params);
    assertDraft(await requireOwnEntry(user.id, id));

    const body = z
      .object({
        note: z.string().trim().max(1000).nullable().optional(),
        cursor: z.number().int().min(0).max(500).optional(),
      })
      .parse(request.body);

    await updateEntryMeta(id, body);
    return { entry: await serializeEntry(id) };
  });

  /** 한 스텝의 금액 확정 — 사유 강제(하드룰 2·3)는 services/entry 의 updateLine 이 한다 */
  app.patch('/entries/:id/lines/:lineId', async (request) => {
    const user = await requireUser(request);
    const params = lineParams.parse(request.params);
    assertDraft(await requireOwnEntry(user.id, params.id));

    const body = z
      .object({
        actualAmount: amount,
        changeReason: reason,
        name: z.string().trim().min(1).max(30).optional(),
      })
      .parse(request.body);

    return { line: await updateLine(params.id, params.lineId, body) };
  });

  /** 추가 지출 항목 — 이름부터 받는다 */
  app.post('/entries/:id/lines', async (request) => {
    const user = await requireUser(request);
    const { id } = entryParams.parse(request.params);
    assertDraft(await requireOwnEntry(user.id, id));

    const body = z
      .object({
        name: z.string().trim().min(1, '항목 이름을 적어주세요.').max(30),
        category,
        actualAmount: amount,
      })
      .parse(request.body);

    return { line: await addExtraLine(id, body) };
  });

  app.delete('/entries/:id/lines/:lineId', async (request) => {
    const user = await requireUser(request);
    const params = lineParams.parse(request.params);
    assertDraft(await requireOwnEntry(user.id, params.id));

    await deleteExtraLine(params.id, params.lineId);
    return { ok: true };
  });

  app.post('/entries/:id/submit', async (request) => {
    const user = await requireUser(request);
    const { id } = entryParams.parse(request.params);
    const entry = await requireOwnEntry(user.id, id);
    assertDraft(entry);

    const bookStatus = await submitEntry(entry);
    return { entry: await serializeEntry(id), bookStatus };
  });

  /** 제출한 기록을 다시 연다. 장부가 완성돼 있었다면 다시 '진행 중'으로 내려간다. */
  app.post('/entries/:id/reopen', async (request) => {
    const user = await requireUser(request);
    const { id } = entryParams.parse(request.params);
    const entry = await requireOwnEntry(user.id, id);

    const bookStatus = await reopenEntry(entry);
    return { entry: await serializeEntry(id), bookStatus };
  });
}
