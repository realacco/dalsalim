// 기능: F-FAM-10
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registerPushToken, removePushToken, useSession } from '@/entities/session';

import { type PushState, usePushStore } from './push-store';

/**
 * 이 기기를 알림 받을 기기로 등록하는 일.
 *
 * 알림 자체는 서버가 보낸다 (Expo Push → FCM). 앱이 하는 일은 셋뿐이다 —
 * 권한을 받고 · 토큰을 서버에 올리고 · 로그아웃하면 무른다.
 *
 * 권한은 정산일을 **저장하는 순간**에만 묻는다. 앱을 켜자마자 묻는 알림 권한은 대부분 거절당한다.
 * 그 뒤로는 이미 허락돼 있을 때만 조용히 다시 등록한다 (토큰은 바뀔 수 있다).
 */

/** 앱이 앞에 떠 있어도 알림을 띄운다 — 정산일 알림을 앱 안에서 보고 있다가 놓치면 안 된다 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'default';

/** 이 세션에서 서버에 올린 토큰. 로그아웃 때 무를 것 */
let registeredToken: string | null = null;

/** iOS 는 Apple 개발자 계정이 있어야 푸시가 된다 — 지금은 안드로이드 실기기만 (정의서) */
function pushSupportedHere(): boolean {
  return Platform.OS === 'android' && Device.isDevice;
}

/** 이 빌드·기기에서 토큰이 나오는가. Expo Go 에서는 안 나온다 (SDK 53 부터 안드로이드 Expo Go 는 원격 푸시가 빠졌다) */
async function fetchExpoToken(): Promise<string | null> {
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '정산일 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data;
  } catch (caught) {
    // Expo Go 면 정상이지만, FCM 키가 잘못 얹힌 빌드도 같은 길로 떨어진다 — 이유는 로그에 남긴다
    console.warn('[push] 토큰을 못 받았어요', caught);
    return null;
  }
}

/**
 * 권한이 있으면(또는 `ask` 로 받아내면) 토큰을 서버에 올린다. 결과는 돌려주고 스토어에도 적는다.
 * 토큰이 안 나오는 것(기기 문제)과 서버에 못 올린 것(잠깐 못 닿음)을 가른다 — 카드가 다른 말을 해야 한다.
 */
export async function enablePushForThisDevice({ ask }: { ask: boolean }): Promise<PushState> {
  const state = await resolvePushState(ask);
  usePushStore.getState().setState(state);
  return state;
}

async function resolvePushState(ask: boolean): Promise<PushState> {
  if (!pushSupportedHere()) return 'unavailable';

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return 'denied';

  const token = await fetchExpoToken();
  if (!token) return 'unavailable';

  try {
    await registerPushToken(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch {
    return 'failed';
  }
  registeredToken = token;
  return 'granted';
}

/**
 * 로그아웃 직전에. 실패해도 로그아웃을 막지 않는다 — 토큰은 서버가 죽은 것으로 알아서 지운다.
 * 이번 실행에서 등록에 실패했어도 지난 세션이 올린 토큰이 서버에 남아 있을 수 있다 —
 * 그래서 기억한 토큰이 없으면 한 번 더 뽑아서 무른다. 안 그러면 다음 사람의 폰에 내 알림이 간다.
 */
export async function disablePushForThisDevice(): Promise<void> {
  const remembered = registeredToken;
  registeredToken = null;
  usePushStore.getState().setState(null);
  const token = remembered ?? (pushSupportedHere() ? await fetchExpoToken() : null);
  if (!token) return;
  try {
    await removePushToken(token);
  } catch {
    // 서버에 못 닿았으면 다음 로그인의 등록이 토큰 주인을 갈아끼운다
  }
}

/**
 * 로그인돼 있고 권한이 이미 있으면 조용히 다시 등록한다. 묻지 않는다.
 * 앱 셸에 한 번 두면 앱을 켤 때마다 돈다 — 토큰이 바뀌거나 폰을 바꿨을 때, 그리고
 * 폰 설정에서 알림을 끈 뒤를 잡는다. 결과는 스토어로 가서 가족 탭 카드가 읽는다.
 */
export function usePushRegistration() {
  const userId = useSession((state) => state.me?.user.id ?? null);

  useEffect(() => {
    if (!userId) return;
    void enablePushForThisDevice({ ask: false });
  }, [userId]);
}

/**
 * 알림을 누르면 **그 가족의 홈**으로 간다. 서버가 data.familyId 를 실어 보내는 이유가 이것이다 —
 * 두 가족에 속한 사람이 다른 가족을 보고 있다가 눌러도 정산일인 가족이 열려야 한다.
 * 앱이 꺼져 있다가 알림으로 켜진 경우는 마지막 응답을 한 번 읽어서 같은 길로 보낸다.
 */
export function useNotificationTap() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useSession((state) => state.me?.user.id ?? null);

  useEffect(() => {
    if (!userId) return;

    const open = async (response: Notifications.NotificationResponse | null) => {
      const familyId = response?.notification.request.content.data?.familyId;
      if (typeof familyId !== 'string') return;
      const session = useSession.getState();
      if (!session.me?.memberships.some((m) => m.family.id === familyId)) return;
      if (session.familyId !== familyId) {
        await session.selectFamily(familyId);
        void queryClient.invalidateQueries();
      }
      router.replace('/(tabs)');
    };

    void Notifications.getLastNotificationResponseAsync().then(open);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void open(response);
    });
    return () => subscription.remove();
  }, [userId, router, queryClient]);
}
