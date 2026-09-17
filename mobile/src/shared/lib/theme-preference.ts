// 기능: F-SES-09
import type { ColorScheme } from '@/shared/config/theme';

/** 앱 테마 선택값. `system` 은 폰의 다크 모드 설정을 그대로 따라간다 */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/**
 * 저장소에서 읽은 문자열을 선택값으로 바꾼다.
 * 모르는 값·빈 값은 `system` 이다 — 읽기에 실패했다고 사용자에게 알릴 일이 아니고,
 * 폰 설정을 따라가는 것이 이 기능이 없던 때의 동작이라 가장 덜 놀랍다.
 */
export function parseThemePreference(raw: string | null | undefined): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system';
}

/** 선택값과 폰 설정으로 실제로 그릴 색 체계를 정한다. 폰 설정을 모르면 밝게 그린다 */
export function resolveColorScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
