import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

import { api, setAuthToken } from '../api/client';
import type { Me } from '../api/types';

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
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    const remembered = await SecureStore.getItemAsync(FAMILY_KEY);

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
      // 토큰이 만료됐거나 서버가 초기화된 경우 — 조용히 로그아웃한다
      await SecureStore.deleteItemAsync(TOKEN_KEY);
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
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(FAMILY_KEY);
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
