import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { requireMembership, requireUser } from '../lib/auth.js';
import { fail } from '../lib/http.js';
import { currentYearMonth, isYearMonth } from '../lib/shared.js';
import { serializeEntry } from '../services/entry.js';
import {
  buildBookView,
  buildMonthSummary,
  buildTrend,
  getOrCreateBook,
  openMyEntry,
  refreshBookStatus,
} from '../services/book.js';

const bookParams = z.object({ familyId: z.string(), yearMonth: z.string() });

function parseYearMonth(value: string): string {
  if (!isYearMonth(value)) throw fail('BAD_YEAR_MONTH');
  return value;
}

export async function bookRoutes(app: FastifyInstance) {
  /** 이번 달 홈 화면이 쓰는 단 하나의 엔드포인트 */
  app.get('/families/:familyId/books/:yearMonth', async (request) => {
    const user = await requireUser(request);
    const params = bookParams.parse(request.params);
    const yearMonth = parseYearMonth(params.yearMonth);
    const mine = await requireMembership(user.id, params.familyId);

    const book = await getOrCreateBook(params.familyId, yearMonth);
    return {
      book: { id: book.id, yearMonth: book.yearMonth, status: book.status },
      myMembershipId: mine.id,
      isFuture: yearMonth > currentYearMonth(),
      members: await buildBookView(params.familyId, book.id, mine.id),
    };
  });

  /**
   * 내 기록을 시작하거나 이어서 연다.
   * 처음이면 수입 1줄 + 내 고정비 n줄을 지난달 값으로 채워서 만든다 (프리필 — services/book).
   */
  app.post('/families/:familyId/books/:yearMonth/my-entry', async (request) => {
    const user = await requireUser(request);
    const params = bookParams.parse(request.params);
    const yearMonth = parseYearMonth(params.yearMonth);
    const mine = await requireMembership(user.id, params.familyId);

    const entryId = await openMyEntry(params.familyId, yearMonth, mine.id);
    return { entry: await serializeEntry(entryId) };
  });

  /**
   * 그 달의 요약. **전원이 제출하지 않아도 열린다.** (기획서 3장)
   * 대신 숫자가 몇 명 기준인지를 progress 로 같이 내려보낸다.
   */
  app.get('/families/:familyId/books/:yearMonth/summary', async (request) => {
    const user = await requireUser(request);
    const params = bookParams.parse(request.params);
    const yearMonth = parseYearMonth(params.yearMonth);
    await requireMembership(user.id, params.familyId);

    return buildMonthSummary(params.familyId, yearMonth);
  });

  /** 월별 추이. 엑셀에서 하려면 시트를 다 뒤져야 했던 것이다. (기획서 7.5) */
  app.get('/families/:familyId/trend', async (request) => {
    const user = await requireUser(request);
    const { familyId } = z.object({ familyId: z.string() }).parse(request.params);
    const { months } = z
      .object({ months: z.coerce.number().int().min(1).max(60).default(12) })
      .parse(request.query);
    await requireMembership(user.id, familyId);

    return { months: await buildTrend(familyId, months) };
  });

  /** 장부 상태를 다시 계산한다 (디버깅·복구용) */
  app.post('/families/:familyId/books/:yearMonth/refresh', async (request) => {
    const user = await requireUser(request);
    const params = bookParams.parse(request.params);
    await requireMembership(user.id, params.familyId);

    const book = await getOrCreateBook(params.familyId, parseYearMonth(params.yearMonth));
    return { status: await refreshBookStatus(book.id) };
  });
}
