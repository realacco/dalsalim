// 기능: F-FAM-10
import { isRunningInExpoGo } from 'expo';

import { type PushState, usePushStore } from './model/push-store';

export { type PushState, usePushStore };

type Registration = typeof import('./model/push-registration');

/**
 * 🔴 **Expo Go 에서는 알림 구현을 아예 불러오지 않는다.**
 *
 * `expo-notifications` 는 `index` 에서 `DevicePushTokenAutoRegistration.fx` 를 다시 내보내고,
 * 그 파일은 **불러오는 것만으로** 최상단에서 `addPushTokenListener` 를 부른다. 그 함수는
 * Expo Go + 안드로이드면 그 자리에서 던진다 (SDK 53 부터 원격 푸시가 Expo Go 에서 빠졌다).
 *
 * 그래서 `model/push-registration` 을 정적으로 임포트하면, 그것을 쓰는 `app/_layout` 이 통째로
 * 평가에 실패해 **라우트가 하나도 등록되지 않는다** — 앱이 빈 화면으로 죽는다.
 * 우리 쪽 try/catch 는 함수 호출을 감싼 것이라 모듈을 읽다 나는 이 예외의 밖이다.
 *
 * 값을 한 번만 정해 두는 이유: 훅을 조건부로 부르면 안 되기 때문이다. 실행 환경은 앱이 사는 동안
 * 안 바뀌므로, 여기서 고른 함수가 그대로 훅의 정체가 된다.
 *
 * 개발 빌드·APK 는 이 갈림의 반대쪽이라 지금까지와 똑같이 돈다.
 */
const registration: Registration | null = isRunningInExpoGo()
  ? null
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./model/push-registration') as Registration);

const noop = () => {};

export const usePushRegistration: Registration['usePushRegistration'] =
  registration?.usePushRegistration ?? noop;

export const useNotificationTap: Registration['useNotificationTap'] =
  registration?.useNotificationTap ?? noop;

/**
 * Expo Go 에서는 물어볼 것도 없이 `unavailable` 이다 — 이 기기에서는 토큰이 안 나온다는 뜻이고,
 * 가족 탭 카드가 그렇게 말한다. 정산일 저장은 서버 일이라 그대로 된다.
 */
export const enablePushForThisDevice: Registration['enablePushForThisDevice'] =
  registration?.enablePushForThisDevice ??
  (async (): Promise<PushState> => {
    usePushStore.getState().setState('unavailable');
    return 'unavailable';
  });

/** 무를 토큰이 애초에 없다 — 로그아웃을 붙잡지 않는다 */
export const disablePushForThisDevice: Registration['disablePushForThisDevice'] =
  registration?.disablePushForThisDevice ?? (async () => {});
