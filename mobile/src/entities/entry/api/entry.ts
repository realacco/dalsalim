import { api } from '@/shared/api/client';
import type { Entry, EntryLine } from '../model/types';

export const entryKeys = {
  detail: (entryId: string) => ['entry', entryId] as const,
};

/** 내 기록을 시작하거나 이어서 연다. 서버가 지난달 값으로 채운 초안을 돌려준다. */
export async function openMyEntry(familyId: string, yearMonth: string) {
  const { entry } = await api<{ entry: Entry }>(
    `/families/${familyId}/books/${yearMonth}/my-entry`,
    { method: 'POST' },
  );
  return entry;
}

export async function fetchEntry(entryId: string) {
  const { entry } = await api<{ entry: Entry }>(`/entries/${entryId}`);
  return entry;
}

/** 특이사항 · 위저드 진행 위치 저장 */
export function patchEntry(entryId: string, input: { note?: string | null; cursor?: number }) {
  return api<{ entry: Entry }>(`/entries/${entryId}`, { method: 'PATCH', body: input });
}

/** 한 스텝의 금액 확정. 기본값과 다르면 서버가 사유를 요구한다(REASON_REQUIRED). */
export function updateLine(
  entryId: string,
  lineId: string,
  input: { actualAmount: number; changeReason?: string | null; name?: string },
) {
  return api<{ line: EntryLine }>(`/entries/${entryId}/lines/${lineId}`, {
    method: 'PATCH',
    body: input,
  });
}

/** 추가 지출 — 이름이 곧 사유라서 사유를 받지 않는다 */
export function addExtraLine(
  entryId: string,
  input: { name: string; category: string; actualAmount: number },
) {
  return api<{ line: EntryLine }>(`/entries/${entryId}/lines`, { method: 'POST', body: input });
}

export function deleteLine(entryId: string, lineId: string) {
  return api(`/entries/${entryId}/lines/${lineId}`, { method: 'DELETE' });
}

export function submitEntry(entryId: string) {
  return api<{ entry: Entry; bookStatus: string }>(`/entries/${entryId}/submit`, {
    method: 'POST',
  });
}

/** 제출한 기록을 다시 연다. 장부가 완성돼 있었다면 다시 진행 중으로 내려간다. */
export function reopenEntry(entryId: string) {
  return api<{ entry: Entry; bookStatus: string }>(`/entries/${entryId}/reopen`, {
    method: 'POST',
  });
}
