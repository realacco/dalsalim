// 기능: F-SES-04 F-SES-05 F-SES-09
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Stack, router, usePathname } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, makeStyles, useTheme } from '@/shared/config/theme-provider';
import { hideSplash } from '@/shared/lib/splash';
import { ConfirmHost } from '@/shared/ui';
import { useNotificationTap, usePushRegistration } from '@/features/push';
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

/** ThemeProvider 바깥이라 `makeStyles` 를 못 쓴다. 색·간격이 아니라 레이아웃 값이다 */
const FILL = { flex: 1 } as const;

export default function RootLayout() {
  /*
    세션(토큰) 읽기는 ThemeProvider 바깥에서 시작한다. 안쪽 AppShell 에서 시작하면 테마 저장값을
    다 읽을 때까지 마운트되지 않아 두 보안 저장소 읽기가 줄을 선다 — 테마 읽기가 1초 한도까지
    가면 로그인 확인도 그만큼 늦는다 (F-SES-09)
  */
  const hydrate = useSession((state) => state.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    /*
      gesture-handler 가 요구하는 뿌리. 여태 앱 어디에도 없었고, 제스처를 쓰는 곳이
      아래 시트(`shared/ui/sheet` — Modal 안에 따로 심는다) 하나뿐이라 티가 안 났다.
      루트에 두는 것이 라이브러리가 정한 기본 설치 모양이다.
    */
    <GestureHandlerRootView style={FILL}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <AppShell />
          </SafeAreaProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/** 테마를 읽어야 해서 ThemeProvider 안쪽에 있어야 한다. */
function AppShell() {
  const styles = useStyles();
  const { colors, scheme } = useTheme();
  const ready = useSession((state) => state.ready);
  const token = useSession((state) => state.token);
  const pathname = usePathname();

  // 알림 받을 기기 등록 — 권한이 이미 있을 때만 조용히 · 알림을 누르면 그 가족의 홈으로 (F-FAM-10)
  usePushRegistration();
  useNotificationTap();

  /**
   * 토큰이 "있다가 없어지면" 로그인 화면으로 보낸다. 로그아웃 버튼도, 서버의 401 도
   * 결국 토큰을 비우는 것이므로 화면마다 이동 코드를 두지 않고 여기 한 곳에서 본다.
   * 처음부터 없던 것(앱 첫 실행, 만료된 토큰으로 hydrate 실패)은 Gate 가 보낸다 —
   * ready 가 되기 전의 변화는 세지 않는다.
   */
  const hadToken = useRef(false);
  useEffect(() => {
    if (token) {
      if (ready) hadToken.current = true;
      return;
    }
    if (!hadToken.current) return;
    hadToken.current = false;
    queryClient.clear();
    if (pathname === '/login') return;

    /*
      먼저 스택을 비운다. replace 는 **지금 화면 자리만** 바꾸므로, 탭 위에 얹힌
      화면(내 정보)에서 로그아웃하면 아래 깔린 (tabs) 가 그대로 남고 안드로이드
      뒤로가기로 토큰 없는 탭이 다시 보인다. 이 effect 는 한 번 돌고 나면
      다시 안 도니까(hadToken 이 이미 false 다) 여기서 끝내야 한다.
    */
    if (router.canDismiss()) router.dismissAll();
    router.replace('/login');
  }, [token, ready, pathname]);

  /**
   * 화면 전환 중에 흰 배경이 한 프레임 비치던 문제.
   *
   * 원인은 애니메이션이 아니라 **그 아래 깔린 바탕**이었다. 안드로이드 창 배경과
   * react-navigation 기본 테마가 흰색이라, 들어오는 화면이 아직 안 그려진 순간 그게 비친다.
   * 앱의 루트 배경을 테마 색으로 직접 칠해야 사라진다.
   */
  useEffect(() => {
    // 칠하기를 기다린 뒤에 스플래시를 내린다 — 둘 다 기다리지 않는 네이티브 호출이라 순서를 여기서 정한다.
    // 안 그러면 「어둡게」 로 켤 때 밝은 창 배경이 한 프레임 비친다 (F-SES-09). 칠하기가 실패해도 내린다
    void SystemUI.setBackgroundColorAsync(colors.bg)
      .catch(() => undefined)
      .finally(hideSplash);
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
        <Stack.Screen name="pending" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="me" />
        {/* 위저드는 "지금부터 적는다"는 별도의 상태라 아래에서 올라오는 게 맞다 */}
        <Stack.Screen name="wizard/[entryId]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="summary/[yearMonth]" />
      </Stack>
      {/*
        확인 다이얼로그는 화면이 아니라 앱 전체의 것이다. 여기 하나만 두면
        어느 화면에서 confirm() 을 부르든 같은 모양으로 뜬다.
      */}
      <ConfirmHost />
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  root: { flex: 1, backgroundColor: t.colors.bg },
}));
