import { describe, expect, it } from 'vitest';

import { nativeChanges } from '../../scripts/ota-native-guard.mjs';

/**
 * 이 가드는 **양쪽으로 다 틀릴 수 있다.**
 *
 * 너무 조이면 버그픽스마다 막혀서 force 를 배우고, 그 다음부터는 늘 force 를 쓴다.
 * 너무 풀면 앱이 죽는 번들이 조용히 나간다 — 그쪽은 가족이 알려줄 때까지 모른다.
 * 그래서 "막아야 하는 것"과 같은 무게로 "놓아줘야 하는 것"을 함께 못박아 둔다.
 */
const base = {
  expo: {
    name: '달살림',
    version: '0.1.0',
    runtimeVersion: '1',
    plugins: ['expo-router', 'expo-secure-store'],
    android: { package: 'com.dalsalim.app', versionCode: 2 },
    ios: { bundleIdentifier: 'com.dalsalim.app' },
    experiments: { typedRoutes: false },
  },
};

/** base 를 건드리지 않고 한 곳만 바꾼 사본을 만든다 */
const withExpo = (patch) => ({ expo: { ...base.expo, ...patch } });

describe('놓아줘야 하는 것 — 여기서 막히면 force 를 배운다', () => {
  it('아무것도 안 바뀌면 통과한다', () => {
    expect(nativeChanges(base, base)).toEqual([]);
  });

  it('version 을 올려도 통과한다 — runtimeVersion 을 손으로 올리는 정책이라서', () => {
    expect(nativeChanges(base, withExpo({ version: '0.2.1' }))).toEqual([]);
  });

  it('versionCode 를 올려도 통과한다 — APK 를 구울 때 올라가는 숫자다', () => {
    const after = withExpo({ android: { package: 'com.dalsalim.app', versionCode: 3 } });
    expect(nativeChanges(base, after)).toEqual([]);
  });

  it('experiments 는 빌드 시점에 JS 로만 반영된다', () => {
    expect(nativeChanges(base, withExpo({ experiments: { typedRoutes: true } }))).toEqual([]);
  });
});

describe('막아야 하는 것 — 놓치면 앱이 죽는다', () => {
  it('★ runtimeVersion 이 바뀌면 막는다', () => {
    expect(nativeChanges(base, withExpo({ runtimeVersion: '2' }))).toContain('runtimeVersion');
  });

  it('★ 플러그인이 늘면 막는다 — 네이티브 모듈이 들어온 것이다', () => {
    const after = withExpo({ plugins: ['expo-router', 'expo-secure-store', 'expo-camera'] });
    expect(nativeChanges(base, after)).toContain('plugins');
  });

  it('★ 패키지명이 바뀌면 막는다', () => {
    const after = withExpo({ android: { package: 'com.other.app', versionCode: 2 } });
    expect(nativeChanges(base, after)).toContain('android.package');
  });

  it('★ 앱 이름이 바뀌면 막는다 — 런처에 뜨는 이름은 네이티브다', () => {
    expect(nativeChanges(base, withExpo({ name: '달살림 베타' }))).toContain('name');
  });

  it('★ updates.url 이 바뀌면 막는다', () => {
    const after = withExpo({ updates: { url: 'https://u.expo.dev/other' } });
    expect(nativeChanges(base, after)).toContain('updates.url');
  });

  /**
   * 안전한 것만 빼놓는 방향으로 짠 이유가 이것이다.
   * Expo 가 키를 새로 만들 때 위험 목록을 세는 쪽이었으면 조용히 통과했을 자리다.
   */
  it('★ 모르는 키가 새로 생기면 막는다', () => {
    expect(nativeChanges(base, withExpo({ newNativeThing: true }))).toContain('newNativeThing');
  });

  it('★ 키가 사라져도 막는다', () => {
    const { runtimeVersion: _dropped, ...rest } = base.expo;
    expect(nativeChanges(base, { expo: rest })).toContain('runtimeVersion');
  });

  it('바뀐 것을 전부 보고한다 — 하나만 고치고 다시 막히면 안 된다', () => {
    const after = withExpo({ runtimeVersion: '2', name: '달살림 베타' });
    expect(nativeChanges(base, after)).toEqual(['name', 'runtimeVersion']);
  });
});
