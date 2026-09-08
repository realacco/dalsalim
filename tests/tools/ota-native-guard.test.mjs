import { describe, expect, it } from 'vitest';

import { dependencyChanges, nativeChanges } from '../../scripts/ota-native-guard.mjs';

/**
 * 이 가드는 **양쪽으로 다 틀릴 수 있다.**
 *
 * 너무 조이면 버그픽스마다 막혀서 force 를 배우고, 그 다음부터는 늘 force 를 쓴다.
 * 너무 풀면 앱이 죽는 번들이 조용히 나간다 — 그쪽은 가족이 알려줄 때까지 모른다.
 * 그래서 "막아야 하는 것"과 같은 무게로 "놓아줘야 하는 것"을 함께 못박아 둔다.
 * (scan-secrets.test.mjs 와 같은 이유다)
 */
const base = {
  expo: {
    name: '달살림',
    version: '0.1.0',
    runtimeVersion: '1',
    plugins: ['expo-router', 'expo-secure-store'],
    android: { package: 'com.dalsalim.app', versionCode: 2 },
    ios: { bundleIdentifier: 'com.dalsalim.app' },
    // 실제 app.json 에 있는 모양이다 — 빈 객체가 사라지면 이 경로가 통째로 안 보인다
    extra: { router: {} },
    experiments: { typedRoutes: false },
  },
};

/** base 를 건드리지 않고 한 곳만 바꾼 사본을 만든다 */
const withExpo = (patch) => ({ expo: { ...base.expo, ...patch } });

describe('app.json — 놓아줘야 하는 것', () => {
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

  it('typedRoutes 는 빌드 시점에 JS 로만 반영된다', () => {
    expect(nativeChanges(base, withExpo({ experiments: { typedRoutes: true } }))).toEqual([]);
  });
});

describe('app.json — 막아야 하는 것', () => {
  it('runtimeVersion 이 바뀌면 막는다', () => {
    expect(nativeChanges(base, withExpo({ runtimeVersion: '2' }))).toContain('runtimeVersion');
  });

  it('플러그인이 늘면 막는다 — config plugin 이 있는 네이티브 모듈이 들어온 것이다', () => {
    const after = withExpo({ plugins: ['expo-router', 'expo-secure-store', 'expo-camera'] });
    expect(nativeChanges(base, after)).toContain('plugins');
  });

  it('패키지명이 바뀌면 막는다', () => {
    const after = withExpo({ android: { package: 'com.other.app', versionCode: 2 } });
    expect(nativeChanges(base, after)).toContain('android.package');
  });

  it('앱 이름이 바뀌면 막는다 — 런처에 뜨는 이름은 네이티브다', () => {
    expect(nativeChanges(base, withExpo({ name: '달살림 베타' }))).toContain('name');
  });

  it('updates.url 이 바뀌면 막는다', () => {
    expect(
      nativeChanges(base, withExpo({ updates: { url: 'https://u.expo.dev/other' } })),
    ).toContain('updates.url');
  });

  /**
   * 안전한 것만 빼놓는 방향으로 짠 이유가 이것이다.
   * 위험 목록을 세는 쪽이었으면 Expo 가 키를 새로 만들 때마다 조용히 통과했을 자리다.
   */
  it('모르는 키가 새로 생기면 막는다', () => {
    expect(nativeChanges(base, withExpo({ newNativeThing: true }))).toContain('newNativeThing');
  });

  /** 값이 빈 객체여도 마찬가지다. flatten 이 잎으로 안 남기면 여기서 조용히 새어나간다 */
  it('모르는 키가 빈 객체로 생겨도 막는다', () => {
    expect(nativeChanges(base, withExpo({ newNativeThing: {} }))).toContain('newNativeThing');
  });

  it('빈 객체가 사라져도 막는다 — extra.router 가 실제로 그 모양이다', () => {
    expect(nativeChanges(base, withExpo({ extra: {} }))).toContain('extra.router');
  });

  /** experiments 를 가지째 열어두면 그 안쪽에서만 원칙이 뒤집힌다 */
  it('experiments 안에 모르는 것이 생기면 막는다', () => {
    const after = withExpo({ experiments: { typedRoutes: false, someNativeFlag: true } });
    expect(nativeChanges(base, after)).toContain('experiments.someNativeFlag');
  });

  it('키가 사라져도 막는다', () => {
    const { runtimeVersion: _dropped, ...rest } = base.expo;
    expect(nativeChanges(base, { expo: rest })).toContain('runtimeVersion');
  });

  it('바뀐 것을 전부 보고한다 — 하나만 고치고 다시 막히면 안 된다', () => {
    const after = withExpo({ runtimeVersion: '2', name: '달살림 베타' });
    expect(nativeChanges(base, after)).toEqual(['name', 'runtimeVersion']);
  });
});

/**
 * 네이티브 모듈이 늘어나는 **가장 흔한 길**이 이쪽이다.
 * config plugin 이 필요 없는 모듈은 app.json 을 안 건드리므로,
 * app.json 만 보는 가드는 정확히 자기가 막으려던 실패를 놓친다.
 */
describe('package.json — 의존성', () => {
  const pkg = {
    dependencies: { expo: '~57.0.18', 'react-native': '0.86.3' },
    devDependencies: { typescript: '^5.9.3' },
  };

  it('안 바뀌면 통과한다', () => {
    expect(dependencyChanges(pkg, pkg)).toEqual([]);
  });

  it('devDependencies 는 보지 않는다 — 번들에 안 실린다', () => {
    const after = { ...pkg, devDependencies: { typescript: '^5.9.4', vitest: '^5.0.0' } };
    expect(dependencyChanges(pkg, after)).toEqual([]);
  });

  it('config plugin 없이 오토링킹되는 모듈이 늘어도 잡는다', () => {
    const after = { ...pkg, dependencies: { ...pkg.dependencies, 'expo-haptics': '~15.0.0' } };
    expect(dependencyChanges(pkg, after)).toEqual(['추가  expo-haptics@~15.0.0']);
  });

  it('빠지면 잡는다', () => {
    const after = { ...pkg, dependencies: { expo: '~57.0.18' } };
    expect(dependencyChanges(pkg, after)).toEqual(['삭제  react-native']);
  });

  it('버전만 올라가도 잡는다 — 패치에 네이티브가 섞일 수 있다', () => {
    const after = { ...pkg, dependencies: { ...pkg.dependencies, expo: '~57.1.0' } };
    expect(dependencyChanges(pkg, after)).toEqual(['변경  expo  ~57.0.18 → ~57.1.0']);
  });
});
