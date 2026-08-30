import { api } from '@/shared/api/client';
import type { Family, FamilyDetail } from '../model/types';

export const familyKeys = {
  detail: (familyId: string | null) => ['family', familyId] as const,
};

export function fetchFamily(familyId: string) {
  return api<FamilyDetail>(`/families/${familyId}`);
}

export async function createFamily(input: { name: string; displayName: string }) {
  const { family } = await api<{ family: Family }>('/families', { method: 'POST', body: input });
  return family;
}

export async function joinFamily(input: { inviteCode: string; displayName: string }) {
  const { family } = await api<{ family: Family }>('/families/join', {
    method: 'POST',
    body: input,
  });
  return family;
}

/** 초대코드 재발급 — 예전 코드를 아는 사람을 막고 싶을 때. OWNER 전용 */
export function regenerateInviteCode(familyId: string) {
  return api<{ inviteCode: string }>(`/families/${familyId}/invite-code`, { method: 'POST' });
}

export function updateMyDisplayName(familyId: string, displayName: string) {
  return api(`/families/${familyId}/me`, { method: 'PATCH', body: { displayName } });
}
