// 기능: F-SES-09
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import { type ThemePreference, parseThemePreference } from './theme-preference';

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

/** 보안 저장소 읽기를 기다리는 한도. 넘기면 기기 설정으로 시작한다 — 스플래시에 갇히는 것보다 낫다 */
const HYDRATE_TIMEOUT_MS = 1000;

/** 저장소 쓰기 줄. 앞의 쓰기가 실패해도 뒤의 쓰기는 이어서 돈다 */
let writes: Promise<void> = Promise.resolve();

/** 몇 번째로 누른 것인가. 마지막으로 누른 것인지를 값이 아니라 순번으로 가른다 */
let lastChoice = 0;

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // 던지지 않고 멈추는 경우까지 막는다. 여기서 안 돌아오면 ThemeProvider 가 아무것도 안 그리고
      // 스플래시도 앱 셸이 뜬 뒤에야 내려가므로 사용자에게는 "앱이 안 켜진다" 로 보인다
      const raw = await Promise.race([
        SecureStore.getItemAsync(KEY),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('theme read timeout')), HYDRATE_TIMEOUT_MS);
        }),
      ]);
      set({ ready: true, preference: parseThemePreference(raw) });
    } catch {
      // 못 읽었다고 앱을 막을 일은 아니다. 기능이 없던 때처럼 폰 설정을 따라간다
      set({ ready: true, preference: 'system' });
    } finally {
      clearTimeout(timer);
    }
  },

  choose: async (preference) => {
    const choice = ++lastChoice;
    set({ preference });
    // 칩을 연달아 누르면 쓰기가 겹친다. 겹친 쓰기는 끝나는 순서가 정해져 있지 않아 앞의 값이
    // 마지막에 닿을 수 있고, 그러면 다음 실행에서 조용히 되돌아간다. 쓰기를 누른 순서대로
    // 한 줄로 세우면 마지막에 누른 값이 마지막에 저장된다
    const write = writes.then(() => SecureStore.setItemAsync(KEY, preference));
    writes = write.catch(() => undefined);
    try {
      await write;
    } catch (caught) {
      // 그사이 또 눌렀으면 이 쓰기는 이미 낡았다. 실패를 알리면 뒤에 줄 선 마지막 쓰기가
      // 저장될 텐데도 "안 됐어요" 가 뜬다 — 알리는 것은 마지막으로 누른 쓰기의 실패뿐이다.
      // 값으로 비교하면 어둡게 → 밝게 → 어둡게 에서 첫 쓰기를 마지막 것으로 오인한다
      if (choice === lastChoice) throw caught;
    }
  },
}));
