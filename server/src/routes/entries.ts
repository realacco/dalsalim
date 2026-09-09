// 기능: F-ENT-02 F-ENT-03 F-ENT-04 F-ENT-05 F-ENT-06 F-ENT-07 F-ENT-08 F-ENT-10
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireOwnEntry, requireUser } from '../lib/auth.js';
import { amount, category } from '../lib/schemas.js';
import {
  addExtraLine,
  assertDraft,
  deleteEntry,
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

  /**
   * 기록을 지운다. **작성 중인 이번 달 기록만** 지워진다 (하드룰 6 — services/entry 참조).
   *
   * 다른 핸들러와 달리 여기서 assertDraft 를 부르지 않는다. 월 검사보다 먼저 돌면
   * 지난 달 제출본에 "되열어라"는 안내가 나가는데 되열어도 못 지운다 — 순서를 services 가 쥔다.
   */
  app.delete('/entries/:id', async (request) => {
    const user = await requireUser(request);
    const { id } = entryParams.parse(request.params);
    const entry = await requireOwnEntry(user.id, id);

    const bookStatus = await deleteEntry(entry);
    return { ok: true, bookStatus };
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
