import { ReactNode, createContext, useContext, useMemo } from 'react';
import {
  type ImageStyle,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
  useColorScheme,
} from 'react-native';

import { type ColorScheme, type Theme, buildTheme } from './theme';

/**
 * 테마를 화면에 흘려보낸다.
 *
 * StyleSheet.create 를 모듈 최상단에서 부르면 그 순간의 색이 그대로 굳는다.
 * 그래서 다크 모드를 하려면 스타일을 **렌더 시점에** 만들어야 한다. makeStyles 가 그 일을 한다.
 *
 * 지금은 기기 설정을 그대로 따라간다. 나중에 앱 안에서 직접 고르게 하려면
 * ThemeProvider 에 override 를 넘기면 되도록 열어뒀다.
 */
const ThemeContext = createContext<Theme>(buildTheme('light'));

export function ThemeProvider({
  children,
  override,
}: {
  children: ReactNode;
  override?: ColorScheme;
}) {
  const system = useColorScheme();
  const scheme: ColorScheme = override ?? (system === 'dark' ? 'dark' : 'light');
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

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
