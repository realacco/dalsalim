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
    } finally {
      setRefreshing(false);
    }
  }

  /**
   * 다른 가족으로 갈아탄다. 캐시를 그대로 두면 바꾼 직후 한 프레임 동안
   * 아까 보던 가족의 숫자가 남아 있으므로 비우고 간다.
   */
  async function switchFamily(nextFamilyId: string) {
    if (nextFamilyId !== familyId) {
      await selectFamily(nextFamilyId);
      await queryClient.invalidateQueries();
    }
    router.replace('/(tabs)');
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
