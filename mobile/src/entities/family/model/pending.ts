// 기능: F-FAM-04
import type { MyPendingRequest } from './types';

/**
 * 기다리던 요청 중 **승인된 가족**. 없으면 `null`.
 *
 * 🔴 **「내 가족 목록에 무엇이든 들어 있으면 승인」으로 읽으면 안 된다** (하드룰 8 · F-FAM-04).
 * 가족은 하나만 가질 수 있는 게 아니라서, 이미 가족이 있는 사람이 다른 가족에 요청하면
 * 목록에는 **처음부터 원래 가족이 들어 있다.** 그걸 승인으로 읽으면 승인되지도 않았는데
 * 원래 가족으로 갈아탄 뒤 탭으로 되돌려 보내고, 요청은 그대로 매달려 있다.
 *
 * 판정은 하나다 — **기다리던 그 `familyId` 가 `/me` 에 `ACTIVE` 로 나타났나.**
 * `/me` 는 `ACTIVE` 만 주므로(하드룰 8) 대기하던 가족이 거기 보이면 그것이 곧 승인이고,
 * 같은 가족에 `ACTIVE` 와 `PENDING` 이 동시에 있을 수 없어 원래 가족이 섞여 들어오지 않는다.
 *
 * @param waitingFamilyIds 기다리던 요청의 familyId — 요청한 순서대로
 * @param activeFamilyIds `/me` 가 준 가족 id
 */
export function approvedFamilyId(
  waitingFamilyIds: readonly string[],
  activeFamilyIds: readonly string[],
): string | null {
  const active = new Set(activeFamilyIds);
  return waitingFamilyIds.find((id) => active.has(id)) ?? null;
}

/** 요청 목록에서 기다리는 familyId 만 뽑는다 — 승인되면 목록에서 사라지므로 화면이 따로 들고 있어야 한다 */
export function waitingFamilyIds(requests: readonly MyPendingRequest[]): string[] {
  return requests.map((r) => r.family.id);
}

/**
 * 기다리는 요청이 하나도 안 남았을 때 갈 곳.
 *
 * 거절과 취소는 **원래 가족을 건드리지 않는다.** 가족이 있는 사람을 온보딩으로 보내면
 * 멀쩡히 쓰던 장부를 두고 「가족 만들기」 앞에 서게 된다.
 */
export function exitWithoutRequests(hasFamily: boolean): '/(tabs)' | '/onboarding' {
  return hasFamily ? '/(tabs)' : '/onboarding';
}
