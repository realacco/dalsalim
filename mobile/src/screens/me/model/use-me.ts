import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/entities/session';
import { disablePushForThisDevice } from '@/features/push';
import { MESSAGES } from '@/shared/config/messages';
import { useThemePreference } from '@/shared/config/theme-preference-store';
import { errorMessage, isSessionExpired } from '@/shared/lib/errors';
import { THEME_PREFERENCES, type ThemePreference } from '@/shared/config/theme-preference';

/** 칩에 붙는 이름. 「시스템」 은 개발자 말이라 폰에서 보이는 말인 「기기 설정」 으로 쓴다 */
const THEME_LABELS: Record<ThemePreference, string> = {
  system: '기기 설정',
  light: '밝게',
  dark: '어둡게',
};

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
  const themePreference = useThemePreference((state) => state.preference);
  const chooseThemePreference = useThemePreference((state) => state.choose);

  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshMe();
    } catch (caught) {
      // 조용히 넘기면 "가족 이름이 그대로네" 를 최신으로 읽는다 — 이 화면에서 당기는 이유가
      // 남이 바꾼 가족 이름을 보려는 것이라 실패가 안 보이면 틀린 값을 믿게 된다.
      // 다른 화면은 useQuery 가 있어 QueryError 카드가 뜨는데 여기는 그 자리가 없다.
      if (!isSessionExpired(caught)) {
        Alert.alert(MESSAGES.actionFailed, errorMessage(caught, MESSAGES.actionFailedBody));
      }
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
   * 돌아가는 곳은 back() 이다. replace 로 탭을 다시 밀면 이미 아래 깔린 탭 위에 한 겹이
   * 더 쌓인다. 목록은 /me 가 ACTIVE 만 실어 보내므로 거의 항상 가족 탭에서 온 사람만 채워져
   * 있는데, 승인 대기 화면에서 들어와 당겨서 새로고침하는 사이 승인이 나면 대기 화면으로
   * 돌아간다 — 그 화면이 빈 목록을 보고 스스로 탭으로 보내므로 막히지는 않는다.
   */
  async function switchFamily(nextFamilyId: string) {
    if (nextFamilyId !== familyId) {
      try {
        // 보안 저장소에 쓰는 일이라 던질 수 있다. 던지면 바꾸지 못한 채 화면만 닫히므로
        // 여기서 멈추고 알린다 — 목록의 줄마다 붙은 동작이라 문구를 붙일 자리가 Alert 뿐이다.
        // 위의 refresh 와 달리 isSessionExpired 로 거르지 않는다: 서버를 안 타므로 401 이 날 길이 없다
        await selectFamily(nextFamilyId);
      } catch (caught) {
        Alert.alert(MESSAGES.actionFailed, errorMessage(caught, MESSAGES.actionFailedBody));
        return;
      }
      queryClient.clear();
    }
    router.back();
  }

  /**
   * 앱 테마 (F-SES-09). 누르는 순간 앱 전체가 바뀌고 저장은 뒤따른다 — 저장 버튼이 없다.
   * 저장이 실패해도 이번 실행 동안은 고른 테마가 유지되므로 되돌리지 않고 알리기만 한다.
   * 카드에 인라인 문구를 붙일 자리는 있지만 정의서(F-SES-09 예외 표)가 알림 한 번으로 정했다.
   * 이미 고른 칩을 다시 눌러도 저장한다 — 저장이 실패한 뒤 같은 칩으로 다시 시도할 길이다
   */
  async function chooseTheme(next: ThemePreference) {
    try {
      await chooseThemePreference(next);
    } catch (caught) {
      Alert.alert(MESSAGES.actionFailed, errorMessage(caught, MESSAGES.actionFailedBody));
    }
  }

  return {
    nickname: me?.user.nickname ?? '',
    families: me?.memberships ?? [],
    familyId,

    refreshing,
    refresh: () => void refresh(),
    switchFamily: (nextFamilyId: string) => void switchFamily(nextFamilyId),

    themeOptions: THEME_PREFERENCES.map((value) => ({
      value,
      label: THEME_LABELS[value],
      selected: value === themePreference,
    })),
    chooseTheme: (next: ThemePreference) => void chooseTheme(next),

    signingOut,
    /*
      토큰이 비면 앱 셸이 로그인으로 보낸다. 그 전에 이 기기의 알림 등록을 무른다 (F-FAM-10) —
      안 무르면 로그아웃한 폰에 다음 정산일 알림이 그대로 온다.
      무르기가 실패하거나 느려도 로그아웃은 한다 (finally). 그동안 버튼은 도는 중으로 보인다.
    */
    signOut: () => {
      setSigningOut(true);
      void disablePushForThisDevice().finally(signOut);
    },
  };
}
