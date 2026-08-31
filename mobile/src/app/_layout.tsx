import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/shared/config/theme-provider';
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
  const { colors, scheme } = useTheme();
  const hydrate = useSession((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <>
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
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="wizard/[entryId]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="summary/[yearMonth]" />
      </Stack>
    </>
  );
}
