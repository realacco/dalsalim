import { beforeEach, describe, expect, it, vi } from 'vitest';

// 세션은 보안 저장소와 api() 를 물고 있다. 여기서 보려는 건 signOut 의 뒷정리뿐이다
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock('@/shared/api/client', () => ({
  api: vi.fn(),
  onUnauthorized: vi.fn(),
  setAuthToken: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';

import { api } from '@/shared/api/client';
import { useSession } from './session';
import type { Me } from './types';

const TOKEN_KEY = 'dalsalim.token';
const FAMILY_KEY = 'dalsalim.familyId';

function signedIn() {
  useSession.setState({
    ready: true,
    token: 't0k3n',
    me: {
      user: { id: 'u1', nickname: '아빠', profileImageUrl: null, isDev: false },
      memberships: [],
    },
    familyId: 'f1',
  });
}

describe('★ F-SES-04 signOut — 저장소가 말을 안 들어도 나간다', () => {
  beforeEach(() => {
    vi.mocked(SecureStore.deleteItemAsync).mockReset();
    signedIn();
  });

  it('저장소 삭제가 던져도 세션을 비운다', async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValue(new Error('저장소가 잠겼어요'));

    await useSession.getState().signOut();

    // 로그아웃을 눌렀는데 그대로 있는 것이 가장 나쁘다 (F-SES-04)
    expect(useSession.getState()).toMatchObject({ token: null, me: null, familyId: null });
  });

  it('토큰 삭제가 던져도 기억된 가족 id 를 같이 지운다', async () => {
    vi.mocked(SecureStore.deleteItemAsync).mockImplementation(async (key: string) => {
      if (key === TOKEN_KEY) throw new Error('저장소가 잠겼어요');
    });

    await useSession.getState().signOut();

    // 둘은 서로 의존이 없다. 이어 붙이면 앞의 것이 던질 때 뒤의 것이 아예 안 돈다
    const keys = vi.mocked(SecureStore.deleteItemAsync).mock.calls.map(([key]) => key);
    expect(keys).toContain(TOKEN_KEY);
    expect(keys).toContain(FAMILY_KEY);
  });
});

/*
  hydrate 의 유일한 계약은 「어떤 길로 들어와도 ready 로 끝난다」다. ready 가 false 로 남으면
  게이트가 로딩에서 못 나오고, 앱을 껐다 켜도 같은 저장소를 또 읽어 그대로 멈춘다 (#54).
*/
describe('★ F-SES-04 hydrate — 저장소가 말을 안 들어도 ready 로 끝난다', () => {
  const me: Me = {
    user: { id: 'u1', nickname: '아빠', profileImageUrl: null, isDev: false },
    memberships: [
      {
        id: 'm1',
        role: 'OWNER',
        displayName: '아빠',
        settlement: null,
        settlementNotifiedFor: null,
        family: { id: 'f1', name: '김씨네', inviteCode: 'ABC123' },
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(SecureStore.getItemAsync).mockReset();
    vi.mocked(SecureStore.deleteItemAsync).mockReset();
    vi.mocked(api).mockReset();
    useSession.setState({ ready: false, token: null, me: null, familyId: null });
  });

  it('토큰 읽기가 던지면 로그인 안 된 상태로 끝난다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('저장소가 잠겼어요'));

    await expect(useSession.getState().hydrate()).resolves.toBeUndefined();

    expect(useSession.getState()).toMatchObject({ ready: true, token: null, me: null });
  });

  it('기억한 가족 id 읽기만 던지면 로그인은 이어가고 첫 가족을 고른다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key: string) => {
      if (key === FAMILY_KEY) throw new Error('저장소가 잠겼어요');
      return 't0k3n';
    });
    vi.mocked(api).mockResolvedValue(me);

    await useSession.getState().hydrate();

    expect(useSession.getState()).toMatchObject({ ready: true, token: 't0k3n', familyId: 'f1' });
  });

  it('토큰이 만료돼 정리하다 저장소 삭제가 던져도 로그인 안 된 상태로 끝난다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('t0k3n');
    vi.mocked(api).mockRejectedValue(new Error('401'));
    vi.mocked(SecureStore.deleteItemAsync).mockRejectedValue(new Error('저장소가 잠겼어요'));

    await expect(useSession.getState().hydrate()).resolves.toBeUndefined();

    expect(useSession.getState()).toMatchObject({ ready: true, token: null, me: null });
  });
});
