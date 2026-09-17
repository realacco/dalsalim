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
  /**
   * 켤 때 /me 가 401 이 아닌 이유로 실패한 것 (#67). 토큰은 남아 있고 게이트가 [다시 시도] 를 띄운다.
   * 서버에 못 닿은 것은 로그인이 풀린 것이 아니다
   */
  bootError: unknown;

  hydrate: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshMe: () => Promise<Me | null>;
  /** 서버가 돌려준 바뀐 사용자를 그대로 반영한다 — /me 를 다시 부르지 않는다 (F-SES-07) */
  applyUser: (user: Me['user']) => void;
  selectFamily: (familyId: string) => Promise<void>;
};

/**
 * 켤 때 보안 저장소 읽기를 기다리는 한도. 넘기면 못 읽은 것으로 본다 — 로딩에 갇히는 것보다 낫다.
 * 테마 읽기(1초)보다 길게 잡는다. 테마는 넘겨도 기기 설정으로 그릴 뿐이지만, 토큰은 넘기면
 * 로그인 화면으로 가서 그 실행 동안 로그인이 풀린 것처럼 보인다 — 조금 더 기다리는 쪽이 싸다
 */
const STORAGE_READ_TIMEOUT_MS = 2000;

/** 던지지 않고 멈추는 읽기까지 실패로 바꾼다. allSettled 는 reject 만 받아주고 멈춤은 못 받는다 */
function readWithTimeout(key: string): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    SecureStore.getItemAsync(key),
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('storage read timeout')), STORAGE_READ_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

function statusOf(caught: unknown): number | undefined {
  if (typeof caught !== 'object' || caught === null || !('status' in caught)) return undefined;
  return typeof caught.status === 'number' ? caught.status : undefined;
}

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
  bootError: null,

  hydrate: async () => {
    // [다시 시도] 로 다시 불리면 게이트가 로딩으로 돌아가야 누른 것이 보인다
    set({ ready: false, bootError: null });
    /*
      ★ 이 함수의 계약은 「보안 저장소가 던지거나 멈춰도 ready 로 끝난다」다. 저장소 호출 하나가
      던지거나 안 돌아오면 ready 가 false 로 남아 게이트가 로딩에서 못 나오고, 껐다 켜도 같은
      저장소를 또 읽어 그대로 멈춘다 (F-SES-03). 저장소 실패는 세션을 무너뜨리는 사건이 아니다 —
      토큰을 못 읽었으면 로그인 안 된 상태로, 기억한 가족을 못 읽었으면 첫 가족으로 떨어뜨린다.
      읽기가 늦어 한도를 넘긴 경우에도 토큰은 **지우지 않는다** — 다음 실행에서 다시 읽힌다.
      ⚠️ /me 가 네트워크에서 멈추는 경우는 보장하지 않는다. api() 에는 한도가 없다 —
      실패로 돌아오면 아래 catch 가 401 과 그 밖을 가른다 (#67)

      두 읽기를 따로 받는 이유: 가족 id 를 못 읽었다고 멀쩡한 토큰까지 버리면 로그인이 풀린다.
    */
    const [tokenRead, rememberedRead] = await Promise.allSettled([
      readWithTimeout(TOKEN_KEY),
      readWithTimeout(FAMILY_KEY),
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
    } catch (caught) {
      /*
        토큰을 지우는 건 서버가 401 로 거절했을 때뿐이다 (#67). 지하철에서 켜서 서버에 못 닿았거나
        서버가 잠깐 500 을 준 것까지 로그아웃으로 받으면, 신호가 돌아와도 로그인을 다시 해야 한다.
        그때는 토큰을 두고 실패만 남긴다 — 게이트가 [다시 시도] 로 이 함수를 다시 부른다.
        ApiError 를 instanceof 로 보지 않고 status 만 본다 — 세션 테스트가 api 모듈을 통째로 흉내 낸다
      */
      if (statusOf(caught) !== 401) {
        set({ ready: true, me: null, familyId: null, bootError: caught });
        return;
      }
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
    set({ token, bootError: null });

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
    set({ token: null, me: null, familyId: null, bootError: null });
  },

  refreshMe: async () => {
    if (!get().token) return null;
    const me = await api<Me>('/me');
    set({ me, familyId: pickFamilyId(me, get().familyId) });
    return me;
  },

  applyUser: (user) => {
    const me = get().me;
    // 저장 응답이 오기 전에 로그아웃했으면 되살릴 세션이 없고, 그사이 다른 사람으로 들어왔으면 남의 것이다
    if (me && me.user.id === user.id) set({ me: { ...me, user } });
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
