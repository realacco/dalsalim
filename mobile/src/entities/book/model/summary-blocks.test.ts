import { describe, it, expect } from 'vitest';
import { withEmptyBlocks } from './summary-blocks';
import type { MonthSummary } from './types';

/** F-ENT-11 · F-ENT-12 이전 서버가 주던 모양 — settlements · extraIncomes 가 없다 */
const oldShape = {
  book: { id: 'b1', yearMonth: '2026-08', status: 'COMPLETE' },
  progress: { submittedCount: 2, memberCount: 2, pendingMembers: [] },
  totals: { income: 0, fixedTotal: 0, extraTotal: 0, surplus: 0 },
  perMember: [],
  changes: [{ displayName: '아빠', name: '관리비', kind: 'FIXED', delta: 1000, reason: '더위' }],
  extras: [],
  byCategory: [],
  notes: [],
} as unknown as MonthSummary;

describe('withEmptyBlocks — 옛 서버 응답에 없는 목록 블록을 빈 배열로 받친다', () => {
  it('없던 블록은 빈 배열이 된다 — 화면의 .length 가 안 터진다', () => {
    const filled = withEmptyBlocks(oldShape);
    expect(filled.settlements).toEqual([]);
    expect(filled.extraIncomes).toEqual([]);
  });

  it('있던 블록은 그대로다 — 서버가 준 것을 덮지 않는다', () => {
    const filled = withEmptyBlocks(oldShape);
    expect(filled.changes).toBe(oldShape.changes);
    expect(filled.book).toBe(oldShape.book);
  });
});
