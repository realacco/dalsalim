import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/entities/session';

/**
 * 내 정보 화면의 상태 조립. 화면은 여기서 받은 것을 그리기만 한다.
 *
 * ★ 서버를 새로 부르지 않는다 — 이 화면이 보여주는 것은 전부 `/me` 에 이미 실려 있다.
 * 그래서 useQuery 가 하나도 없고, 당겨서 새로고침도 세션의 refreshMe 를 부른다.
 */
export function useMe() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, familyId, refreshMe, selectFamily, signOut } = useSession();

  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshMe();
    } catch {
      // 일부러 삼킨다. 보여주는 값은 이미 세션에 있어 실패해도 화면이 비지 않고,
      // 당겨서 새로고침은 안 되면 한 번 더 당기면 되는 동작이라 붙일 자리가 없다.
    } finally {
      setRefreshing(false);
    }
  }

  /**
   * 다른 가족으로 갈아탄다.
   *
   * clear() 다. invalidateQueries() 는 stale 표시와 리패치일 뿐이라 이전 가족의 응답이
   * 캐시에 남고, 바꾼 직후 한 프레임 동안 아까 보던 숫자가 비친다.
   * 가족 나가기(use-family)와 승인 확인(pending)도 같은 이유로 clear() 를 쓴다.
   *
   * 돌아가는 곳은 back() 이다 — 가족 목록이 비지 않는 사람은 가족 탭에서만 여기 올 수 있고
   * (/me 는 ACTIVE 만 실어 보낸다), replace 로 탭을 다시 밀면 스택에 한 겹이 더 쌓인다.
   */
  async function switchFamily(nextFamilyId: string) {
    if (nextFamilyId !== familyId) {
      await selectFamily(nextFamilyId);
      queryClient.clear();
    }
    router.back();
  }

  return {
    nickname: me?.user.nickname ?? '',
    families: me?.memberships ?? [],
    familyId,

    refreshing,
    refresh: () => void refresh(),
    switchFamily: (nextFamilyId: string) => void switchFamily(nextFamilyId),
    // 토큰이 비면 앱 셸이 로그인으로 보낸다
    signOut: () => void signOut(),
  };
}
