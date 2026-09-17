import { describe, expect, it } from 'vitest';

import { THEME_PREFERENCES, parseThemePreference, resolveColorScheme } from './theme-preference';

describe('F-SES-09 parseThemePreference — 저장값 읽기', () => {
  it('저장된 밝게 · 어둡게는 그대로 읽는다', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });

  it('저장된 값이 없거나 모르는 값이면 기기 설정을 따른다', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference(undefined)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('Dark')).toBe('system');
    expect(parseThemePreference('sepia')).toBe('system');
  });

  it('고를 수 있는 값은 셋이고 모두 다시 읽힌다', () => {
    expect(THEME_PREFERENCES).toEqual(['system', 'light', 'dark']);
    for (const preference of THEME_PREFERENCES) {
      expect(parseThemePreference(preference)).toBe(preference);
    }
  });
});

describe('F-SES-09 resolveColorScheme — 그릴 색 체계 정하기', () => {
  it('기기 설정을 따르면 폰의 다크 모드를 그대로 쓴다', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
  });

  it('폰 설정을 모르면 밝게 그린다', () => {
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
    expect(resolveColorScheme('system', 'unspecified')).toBe('light');
  });

  it('밝게 · 어둡게를 고르면 폰 설정과 상관없이 그것을 쓴다', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
    expect(resolveColorScheme('dark', null)).toBe('dark');
  });
});
