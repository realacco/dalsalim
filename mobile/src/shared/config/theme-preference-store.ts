// 기능: F-SES-09
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import { type ThemePreference, parseThemePreference } from '@/shared/lib/theme-preference';

/**
 * 앱 테마 선택값 — **계정이 아니라 이 폰의 것**이다.
 *
 * 서버에 올리지 않고, 로그아웃해도 지우지 않는다. 같은 사람이 폰과 태블릿에서 다르게 쓸 수 있고,
 * 밝기 취향은 그 기기가 놓인 자리의 것이라서다 (F-SES-06 의 "이 폰" 섹션).
 *
 * 저장소가 SecureStore 인 이유: 이미 들어와 있는 유일한 기기 저장소다. AsyncStorage 를 들이면
 * 네이티브 모듈이 하나 늘어 Expo Go 루프를 흔든다 — 문자열 하나에 그 값을 치를 이유가 없다.
 */
const KEY = 'dalsalim.theme';

type ThemePreferenceState = {
  /** 저장값을 읽었는가. 읽기 전에 그리면 "어둡게" 를 고른 사람에게도 밝은 화면이 한 번 비친다 */
  ready: boolean;
  preference: ThemePreference;
  hydrate: () => Promise<void>;
  /** 화면은 바로 바꾸고 저장은 뒤따른다. 저장이 실패하면 던진다 — 이번 실행 동안은 고른 값이 유지된다 */
  choose: (preference: ThemePreference) => Promise<void>;
};

export const useThemePreference = create<ThemePreferenceState>((set, get) => ({
  ready: false,
  preference: 'system',

  hydrate: async () => {
    if (get().ready) return;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      set({ ready: true, preference: parseThemePreference(raw) });
    } catch {
      // 못 읽었다고 앱을 막을 일은 아니다. 기능이 없던 때처럼 폰 설정을 따라간다
      set({ ready: true, preference: 'system' });
    }
  },

  choose: async (preference) => {
    set({ preference });
    await SecureStore.setItemAsync(KEY, preference);
    // 칩을 연달아 누르면 쓰기가 겹친다. 먼저 시작한 쓰기가 늦게 끝나면 저장소에 앞의 값이 남아
    // 다음 실행에서 조용히 되돌아가므로, 끝난 뒤 그사이 바뀐 값이 있으면 마지막 값을 다시 쓴다
    const latest = get().preference;
    if (latest !== preference) await SecureStore.setItemAsync(KEY, latest);
  },
}));
