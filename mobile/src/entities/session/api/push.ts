// 기능: F-FAM-10
import { api } from '@/shared/api/client';

/** 이 기기를 알림 받을 기기로. 토큰은 사람의 것이라 가족과 무관하게 /me 아래에 있다 */
export function registerPushToken(token: string, platform: 'android' | 'ios') {
  return api<{ ok: true }>('/me/push-token', { method: 'PUT', body: { token, platform } });
}

/** 로그아웃할 때 무른다 — 다음 사람이 같은 폰으로 로그인해도 내 알림이 안 간다 */
export function removePushToken(token: string) {
  return api<{ ok: true }>('/me/push-token', { method: 'DELETE', body: { token } });
}
