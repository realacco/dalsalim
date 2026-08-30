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

/**
 * 가족에서 빼기 — 본인 id 면 나가기, OWNER 가 남을 지목하면 내보내기.
 * 서버는 지우지 않고 비활성화한다. 지난 장부의 합계가 바뀌면 안 되기 때문이다.
 */
export function removeMember(familyId: string, membershipId: string) {
  return api<{ ok: true; membershipId: string }>(
    `/families/${familyId}/members/${membershipId}`,
    { method: 'DELETE' },
  );
}

/** 가족장 넘기기. 넘긴 사람은 일반 멤버가 된다. */
export function transferOwner(familyId: string, membershipId: string) {
  return api<{ ok: true; ownerMembershipId: string }>(`/families/${familyId}/transfer-owner`, {
    method: 'POST',
    body: { membershipId },
  });
}
