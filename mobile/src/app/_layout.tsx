import { useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, makeStyles, useTheme } from '@/shared/config/theme-provider';
import { useSession } from '@/entities/session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // 가계부는 초 단위로 바뀌는 데이터가 아니다. 화면에 들어올 때만 다시 받아온다.
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppShell />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** 테마를 읽어야 해서 ThemeProvider 안쪽에 있어야 한다. */
function AppShell() {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const hydrate = useSession((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  /**
   * 화면 전환 중에 흰 배경이 한 프레임 비치던 문제.
   *
   * 원인은 애니메이션이 아니라 **그 아래 깔린 바탕**이었다. 안드로이드 창 배경과
   * react-navigation 기본 테마가 흰색이라, 들어오는 화면이 아직 안 그려진 순간 그게 비친다.
   * 앱의 루트 배경을 테마 색으로 직접 칠해야 사라진다.
   */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.bg);
  }, [colors.bg]);

  return (
    // 네비게이터 뒤에도 같은 색을 깔아둔다 — 전환 중 잠깐 드러나는 면이다
    <View style={styles.root}>
      {/* 어두운 배경에서는 상태바 글자가 밝아야 보인다 */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {/*
        화면을 전부 명시한다. Stack 에 자식을 하나만 두면 그게 초기 화면이 되어버린다 —
        위저드만 선언했다가 앱이 위저드로 시작하는 문제를 겪었다. 순서 = 초기 라우트.
      */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          // 통째로 미끄러지는 slide_from_right 는 종이가 넘어가는 것처럼 뚝뚝 끊겼다.
          // ios_from_right 는 뒤 화면이 조금 따라 밀리며 어두워져 깊이가 생긴다.
          animation: 'ios_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        {/* 위저드는 "지금부터 적는다"는 별도의 상태라 아래에서 올라오는 게 맞다 */}
        <Stack.Screen name="wizard/[entryId]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="summary/[yearMonth]" />
      </Stack>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
}));
