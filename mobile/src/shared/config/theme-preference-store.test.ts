import { beforeEach, describe, expect, it, vi } from 'vitest';

// 스토어는 보안 저장소를 물고 있다. 여기서 보려는 건 저장소가 말을 안 들을 때의 동작뿐이다
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

type SecureStoreModule = typeof import('expo-secure-store');
type StoreModule = typeof import('./theme-preference-store');

const KEY = 'dalsalim.theme';

let SecureStore: SecureStoreModule;
let useThemePreference: StoreModule['useThemePreference'];

/*
  케이스마다 모듈을 새로 불러온다. 스토어는 모듈 전역에 쓰기 줄을 들고 있어서, 앞 케이스가
  끝나지 않은 쓰기를 남기면 다음 케이스의 쓰기가 그 뒤에서 영영 기다린다 — 원인을 찾기 어려운 실패다
*/
beforeEach(async () => {
  vi.resetModules();
  SecureStore = await import('expo-secure-store');
  ({ useThemePreference } = await import('./theme-preference-store'));
});

/** 대기 중인 약속들이 한 바퀴 돌 틈을 준다 */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * 쓰기가 **언제 끝날지를 테스트가 정하는** 저장소. 연달아 누르기는 끝나는 순서가 전부라,
 * 느린 쓰기를 흉내 내려면 각 쓰기를 붙잡아 두었다가 원하는 순서로 풀어야 한다.
 */
function heldStorage() {
  const pending: { resolve: () => void; reject: () => void }[] = [];
  const stored: string[] = [];
  vi.mocked(SecureStore.setItemAsync).mockImplementation(
    (_key, value) =>
      new Promise<void>((resolve, reject) => {
        pending.push({
          resolve: () => {
            stored.push(value);
            resolve();
          },
          reject: () => reject(new Error('keystore')),
        });
      }),
  );

  const take = (index: number) => pending.splice(index, 1)[0];
  return {
    stored,
    /** 가장 나중에 시작한 쓰기를 먼저 끝낸다 — 먼저 시작한 쓰기가 늦게 끝나는 최악의 순서 */
    async finishNewest() {
      await tick();
      take(pending.length - 1)?.resolve();
      await tick();
    },
    async failOldest() {
      await tick();
      take(0)?.reject();
      await tick();
    },
    async finishAll() {
      for (let guard = 0; guard < 20; guard++) {
        await tick();
        if (pending.length === 0) return;
        take(pending.length - 1).resolve();
      }
    },
  };
}

describe('F-SES-09 hydrate — 켤 때 저장값 읽기', () => {
  it('저장된 어둡게를 읽고 준비됨으로 바뀐다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue('dark');

    await useThemePreference.getState().hydrate();

    expect(SecureStore.getItemAsync).toHaveBeenCalledWith(KEY);
    expect(useThemePreference.getState()).toMatchObject({ ready: true, preference: 'dark' });
  });

  it('읽기가 실패해도 기기 설정으로 시작한다 — 앱이 안 뜨면 안 된다', async () => {
    vi.mocked(SecureStore.getItemAsync).mockRejectedValue(new Error('keystore'));

    await expect(useThemePreference.getState().hydrate()).resolves.toBeUndefined();

    expect(useThemePreference.getState()).toMatchObject({ ready: true, preference: 'system' });
  });

  it('읽기가 던지지 않고 멈춰도 1초 뒤 기기 설정으로 시작한다 — 스플래시에 갇히지 않는다', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(SecureStore.getItemAsync).mockReturnValue(
        new Promise<string | null>(() => undefined),
      );

      const pending = useThemePreference.getState().hydrate();
      expect(useThemePreference.getState().ready).toBe(false);
      await vi.advanceTimersByTimeAsync(1000);
      await pending;

      expect(useThemePreference.getState()).toMatchObject({ ready: true, preference: 'system' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('F-SES-09 choose — 고르기', () => {
  it('고르면 저장한다', async () => {
    vi.mocked(SecureStore.setItemAsync).mockResolvedValue();

    await useThemePreference.getState().choose('light');

    expect(useThemePreference.getState().preference).toBe('light');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(KEY, 'light');
  });

  it('저장이 실패해도 화면은 고른 테마로 남고, 실패는 알린다', async () => {
    vi.mocked(SecureStore.setItemAsync).mockRejectedValue(new Error('keystore'));

    await expect(useThemePreference.getState().choose('dark')).rejects.toThrow('keystore');

    expect(useThemePreference.getState().preference).toBe('dark');
  });

  it('두 번 연달아 누르면 먼저 시작한 쓰기가 늦게 끝나도 마지막 값이 저장된다', async () => {
    const storage = heldStorage();

    const dark = useThemePreference.getState().choose('dark');
    const light = useThemePreference.getState().choose('light');
    await storage.finishAll();
    await Promise.all([dark, light]);

    expect(useThemePreference.getState().preference).toBe('light');
    expect(storage.stored.at(-1)).toBe('light');
  });

  it('세 번 누르는 사이에 쓰기가 끝나도 마지막 값이 마지막에 저장된다', async () => {
    const storage = heldStorage();

    const first = useThemePreference.getState().choose('dark');
    const second = useThemePreference.getState().choose('light');
    await storage.finishNewest(); // 밝게가 먼저 끝나고
    await storage.finishNewest(); // 늦게 끝난 어둡게가 뒤따른다
    const third = useThemePreference.getState().choose('dark');
    await storage.finishAll();
    await Promise.all([first, second, third]);

    expect(useThemePreference.getState().preference).toBe('dark');
    expect(storage.stored.at(-1)).toBe('dark');
  });

  it('먼저 누른 값의 쓰기만 실패하면 알리지 않고 마지막 값을 저장한다', async () => {
    const storage = heldStorage();

    const dark = useThemePreference.getState().choose('dark');
    const light = useThemePreference.getState().choose('light');
    await storage.failOldest();
    await storage.finishAll();

    await expect(dark).resolves.toBeUndefined();
    await expect(light).resolves.toBeUndefined();
    expect(useThemePreference.getState().preference).toBe('light');
    expect(storage.stored.at(-1)).toBe('light');
  });
});
