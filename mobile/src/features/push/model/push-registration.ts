// 기능: F-FAM-10
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { registerPushToken, removePushToken, useSession } from '@/entities/session';

/**
 * 이 기기를 알림 받을 기기로 등록하는 일.
 *
 * 알림 자체는 서버가 보낸다 (Expo Push → FCM). 앱이 하는 일은 셋뿐이다 —
 * 권한을 받고 · 토큰을 서버에 올리고 · 로그아웃하면 무른다.
 *
 * 권한은 정산일을 **저장하는 순간**에만 묻는다. 앱을 켜자마자 묻는 알림 권한은 대부분 거절당한다.
 * 그 뒤로는 이미 허락돼 있을 때만 조용히 다시 등록한다 (토큰은 바뀔 수 있다).
 */

export type PushState = 'granted' | 'denied' | 'unavailable';

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

/**
 * 권한이 있으면(또는 `ask` 로 받아내면) 토큰을 서버에 올린다.
 * Expo Go 에서는 토큰을 못 받는다 (SDK 53 부터 안드로이드 Expo Go 는 원격 푸시가 빠졌다) — 'unavailable'.
 */
export async function enablePushForThisDevice({ ask }: { ask: boolean }): Promise<PushState> {
  if (!pushSupportedHere()) return 'unavailable';

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return 'denied';

  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: '정산일 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await registerPushToken(token, 'android');
    registeredToken = token;
    return 'granted';
  } catch {
    // Expo Go · FCM 키가 안 들어간 빌드. 정산일은 저장되고 알림만 못 받는다
    return 'unavailable';
  }
}

/** 로그아웃 직전에. 실패해도 로그아웃을 막지 않는다 — 토큰은 서버가 죽은 것으로 알아서 지운다 */
export async function disablePushForThisDevice(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await removePushToken(token);
  } catch {
    // 서버에 못 닿았으면 다음 로그인의 등록이 토큰 주인을 갈아끼운다
  }
}

/**
 * 로그인돼 있고 권한이 이미 있으면 조용히 다시 등록한다. 묻지 않는다.
 * 앱 셸에 한 번 두면 앱을 켤 때마다 돈다 — 토큰이 바뀌거나 폰을 바꿨을 때를 잡는다.
 */
export function usePushRegistration() {
  const userId = useSession((state) => state.me?.user.id ?? null);

  useEffect(() => {
    if (!userId) return;
    void enablePushForThisDevice({ ask: false });
  }, [userId]);
}
