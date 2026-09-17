// 기능: F-SES-09
import { ReactNode, createContext, useContext, useEffect, useMemo } from 'react';
import {
  type ImageStyle,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
  useColorScheme,
} from 'react-native';

import * as SplashScreen from 'expo-splash-screen';

import { resolveColorScheme } from '@/shared/lib/theme-preference';
import { type Theme, buildTheme } from './theme';
import { useThemePreference } from './theme-preference-store';

/*
  스플래시를 저장값을 읽고 창 배경을 테마 색으로 칠할 때까지 붙잡아 둔다. 그냥 두면 루트 뷰가 붙는
  순간 내려가고, 아래 `return null` 동안 안드로이드 창 배경(app.json 의 밝은 색 한 벌)이 비친다 —
  「어둡게」 를 고른 사람에게는 켤 때마다 밝은 판이 번쩍인다.
  이미 내려갔거나 못 붙잡는 환경이면 던지는데, 그때는 붙잡지 않은 것과 같아 버린다.
*/
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/** 무슨 일이 있어도 이 시간 뒤에는 스플래시를 내린다 — 렌더가 던지면 에러 화면을 덮고 남기 때문이다 */
const SPLASH_MAX_MS = 3000;

let splashHidden = false;

/**
 * 스플래시를 내린다. 여러 번 불러도 한 번만 내린다.
 * 부르는 곳은 앱 셸이다 — 창 배경을 테마 색으로 칠한 **뒤에** 불러야 두 네이티브 호출의 순서가 보장된다.
 */
export function hideSplash() {
  if (splashHidden) return;
  splashHidden = true;
  void SplashScreen.hideAsync().catch(() => undefined);
}

setTimeout(hideSplash, SPLASH_MAX_MS);

/**
 * 테마를 화면에 흘려보낸다.
 *
 * StyleSheet.create 를 모듈 최상단에서 부르면 그 순간의 색이 그대로 굳는다.
 * 그래서 다크 모드를 하려면 스타일을 **렌더 시점에** 만들어야 한다. makeStyles 가 그 일을 한다.
 *
 * 색 체계는 이 폰에 저장된 선택값(F-SES-09)이 정하고, 「기기 설정」 이면 폰의 다크 모드를 따른다.
 */
const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const ready = useThemePreference((state) => state.ready);
  const preference = useThemePreference((state) => state.preference);
  const hydrate = useThemePreference((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const scheme = resolveColorScheme(preference, system);
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  // 저장값을 읽기 전에는 아무것도 그리지 않는다. 먼저 그리면 「어둡게」 를 고른 사람에게도
  // 켤 때마다 밝은 화면이 한 번 비친다. 읽기는 수 밀리초라 스플래시가 가려준다
  if (!ready) return null;

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

/**
 * StyleSheet.create 와 같은 제약을 쓴다.
 * Record<string, object> 로 두면 문맥 타입이 넓어져 fontWeight: '700' 이 string 이 되고,
 * RN 의 TextStyle 이 그걸 거부한다.
 */
type AnyStyle = Record<string, never>;
type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * 테마를 받아 스타일을 만드는 훅을 찍어낸다.
 *
 *   const useStyles = makeStyles((t) => ({ card: { backgroundColor: t.colors.surface } }));
 *   function Card() { const styles = useStyles(); ... }
 *
 * 테마가 그대로면 같은 객체를 재사용하므로 리렌더 비용은 없다.
 */
export function makeStyles<T extends NamedStyles<T> | NamedStyles<AnyStyle>>(
  factory: (theme: Theme) => T & NamedStyles<AnyStyle>,
) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
  };
}
