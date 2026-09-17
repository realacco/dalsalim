import { beforeEach, describe, expect, it, vi } from 'vitest';

// 스토어는 보안 저장소를 물고 있다. 여기서 보려는 건 저장소가 말을 안 들을 때의 동작뿐이다
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';

import { useThemePreference } from './theme-preference-store';

const KEY = 'dalsalim.theme';

beforeEach(() => {
  vi.mocked(SecureStore.getItemAsync).mockReset();
  vi.mocked(SecureStore.setItemAsync).mockReset();
  useThemePreference.setState({ ready: false, preference: 'system' });
});

describe('F-SES-09 hydrate — 켤 때 저장값 읽기', () => {
  it('F-SES-09 저장된 어둡게를 읽고 준비됨으로 바뀐다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('dark');

    await useThemePreference.getState().hydrate();

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(KEY);
    expect(useThemePreference.getState()).toMatchObject({ ready: true, preference: 'dark' });
  });

  it('F-SES-09 읽기가 실패해도 기기 설정으로 시작한다 — 앱이 안 뜨면 안 된다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('keystore'));

    await expect(useThemePreference.getState().hydrate()).resolves.toBeUndefined();

    expect(useThemePreference.getState()).toMatchObject({ ready: true, preference: 'system' });
  });
});

describe('F-SES-09 choose — 고르기', () => {
  it('F-SES-09 고르면 저장한다', async () => {
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue();

    await useThemePreference.getState().choose('light');

    expect(useThemePreference.getState().preference).toBe('light');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, 'light');
  });

  it('F-SES-09 저장이 실패해도 화면은 고른 테마로 남고, 실패는 알린다', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('keystore'));

    await expect(useThemePreference.getState().choose('dark')).rejects.toThrow('keystore');

    expect(useThemePreference.getState().preference).toBe('dark');
  });

  it('F-SES-09 연달아 누르면 먼저 시작한 쓰기가 늦게 끝나도 마지막 값이 저장된다', async () => {
    const stored: string[] = [];
    let releaseFirst: () => void = () => undefined;
    vi.mocked(SecureStore.setItemAsync)
      // 첫 쓰기(어둡게)는 두 번째가 끝난 뒤에야 끝난다
      .mockImplementationOnce(
        (_key, value) =>
          new Promise<void>((resolve) => {
            releaseFirst = () => {
              stored.push(value);
              resolve();
            };
          }),
      )
      .mockImplementation(async (_key, value) => {
        stored.push(value);
      });

    const first = useThemePreference.getState().choose('dark');
    await useThemePreference.getState().choose('light');
    releaseFirst();
    await first;

    expect(useThemePreference.getState().preference).toBe('light');
    expect(stored.at(-1)).toBe('light');
  });
});
