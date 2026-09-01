import { api } from '@/shared/api/client';
import type {
  Family,
  FamilyDetail,
  JoinRequest,
  JoinResult,
  MyPendingRequest,
} from '../model/types';

export const familyKeys = {
  detail: (familyId: string | null) => ['family', familyId] as const,
  joinRequests: (familyId: string | null) => ['family', familyId, 'join-requests'] as const,
  myPending: () => ['family', 'my-pending'] as const,
};

export function fetchFamily(familyId: string) {
  return api<FamilyDetail>(`/families/${familyId}`);
}

export async function createFamily(input: { name: string; displayName: string }) {
  const { family } = await api<{ family: Family }>('/families', { method: 'POST', body: input });
  return family;
}

/** 참여 "요청". 성공해도 아직 구성원이 아니다 — 가족장의 승인을 기다린다. */
export function joinFamily(input: { inviteCode: string; displayName: string }) {
  return api<JoinResult>('/families/join', { method: 'POST', body: input });
}

/** 내가 승인을 기다리는 가족들. 대기 화면이 이걸 본다. */
export async function fetchMyPendingRequests() {
  const { requests } = await api<{ requests: MyPendingRequest[] }>('/families/pending');
  return requests;
}

/** 기다리다 지쳤거나 코드를 잘못 넣었을 때 요청을 무른다 */
export function cancelJoinRequest(membershipId: string) {
  return api<{ ok: true }>(`/families/pending/${membershipId}`, { method: 'DELETE' });
}

/** 들어온 참여 요청 — OWNER 만 볼 수 있다 */
export async function fetchJoinRequests(familyId: string) {
  const { requests } = await api<{ requests: JoinRequest[] }>(
    `/families/${familyId}/join-requests`,
  );
  return requests;
}

export function approveJoinRequest(familyId: string, membershipId: string) {
  return api<{ ok: true; membershipId: string }>(
    `/families/${familyId}/join-requests/${membershipId}/approve`,
    { method: 'POST' },
  );
}

export function rejectJoinRequest(familyId: string, membershipId: string) {
  return api<{ ok: true; membershipId: string }>(
    `/families/${familyId}/join-requests/${membershipId}/reject`,
    { method: 'POST' },
  );
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
