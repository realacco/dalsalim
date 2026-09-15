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

import { useSession } from './session';

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
