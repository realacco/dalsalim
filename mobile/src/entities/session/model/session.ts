import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import { api, onUnauthorized, setAuthToken } from '@/shared/api/client';
import type { Me } from './types';

const TOKEN_KEY = 'dalsalim.token';
const FAMILY_KEY = 'dalsalim.familyId';

type SessionState = {
  ready: boolean;
  token: string | null;
  me: Me | null;
  familyId: string | null;

  hydrate: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  selectFamily: (familyId: string) => Promise<void>;
};

/** 여러 가족에 속할 수 있으므로 마지막에 보던 가족을 기억한다. */
function pickFamilyId(me: Me | null, remembered: string | null): string | null {
  if (!me || me.memberships.length === 0) return null;
  const found = me.memberships.find((m) => m.family.id === remembered);
  return (found ?? me.memberships[0]).family.id;
}

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  token: null,
  me: null,
  familyId: null,

  hydrate: async () => {
    /*
      ★ 이 함수의 유일한 계약은 「어떤 길로 들어와도 ready 로 끝난다」다. 저장소 호출 하나가 던져
      reject 되면 ready 가 false 로 남아 게이트가 로딩에서 못 나오고, 껐다 켜도 같은 저장소를 또
      읽어 그대로 멈춘다 (F-SES-04). 저장소 실패는 세션을 무너뜨리는 사건이 아니다 —
      토큰을 못 읽었으면 로그인 안 된 상태로, 기억한 가족을 못 읽었으면 첫 가족으로 떨어뜨린다.

      두 읽기를 따로 받는 이유: 가족 id 를 못 읽었다고 멀쩡한 토큰까지 버리면 로그인이 풀린다.
    */
    const [tokenRead, rememberedRead] = await Promise.allSettled([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(FAMILY_KEY),
    ]);
    const token = tokenRead.status === 'fulfilled' ? tokenRead.value : null;
    const remembered = rememberedRead.status === 'fulfilled' ? rememberedRead.value : null;

    if (!token) {
      set({ ready: true, token: null, me: null, familyId: null });
      return;
    }

    setAuthToken(token);
    set({ token });

    try {
      const me = await api<Me>('/me');
      set({ ready: true, me, familyId: pickFamilyId(me, remembered) });
    } catch {
      // 토큰이 만료됐거나 서버가 초기화된 경우 — 조용히 로그아웃한다.
      // 그 정리가 실패해도 로그아웃 상태로는 끝낸다. 남은 토큰은 다음 실행에서 /me 가 또 거절해 다시 여기로 온다
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      setAuthToken(null);
      set({ ready: true, token: null, me: null, familyId: null });
    }
  },

  signIn: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    set({ token });

    const me = await api<Me>('/me');
    set({ me, familyId: pickFamilyId(me, null) });
  },

  signOut: async () => {
    /*
      둘을 따로 시도한다. 하나를 await 로 이어 붙이면 앞의 것이 던질 때 뒤의 것이
      아예 안 돌아 기억된 가족 id 만 남는다 — 서로 의존이 없는 두 삭제다.

      실패해도 메모리는 비우고 로그인으로 보낸다 (F-SES-04) — 로그아웃을 눌렀는데
      그대로 있는 것이 가장 나쁘다. ⚠️ 다만 이건 이번 실행에서만이다.
      토큰이 저장소에 남으면 다음 실행의 hydrate() 가 그걸 읽어 세션을 되살린다.
      SecureStore 삭제가 실패하는 길이 사실상 없어 여기까지만 감당한다.
    */
    await Promise.allSettled([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(FAMILY_KEY),
    ]);
    setAuthToken(null);
    set({ token: null, me: null, familyId: null });
  },

  refreshMe: async () => {
    if (!get().token) return null;
    const me = await api<Me>('/me');
    set({ me, familyId: pickFamilyId(me, get().familyId) });
    return me;
  },

  selectFamily: async (familyId) => {
    await SecureStore.setItemAsync(FAMILY_KEY, familyId);
    set({ familyId });
  },
}));

/**
 * 서버가 401 을 주면 세션을 비운다. 로그인 화면으로 보내는 건 앱 셸(app/_layout)이
 * 토큰이 사라진 것을 보고 한다 — 여기는 순수 상태라 라우터를 모른다.
 * 토큰이 없는 상태(로그인 시도 자체가 401)면 비울 것도 없다.
 */
onUnauthorized(() => {
  const { token, signOut } = useSession.getState();
  if (token) void signOut();
});
