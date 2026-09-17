import { API_BASE, api } from '@/shared/api/client';
import type { AuthConfig, Me } from '../model/types';

export const authKeys = {
  config: ['auth-config'] as const,
};

export function fetchAuthConfig() {
  return api<AuthConfig>('/auth/config');
}

export function fetchMe() {
  return api<Me>('/me');
}

/** 앱 닉네임 바꾸기 (F-SES-07). 가족 안 이름(표시 이름)은 안 바뀐다 */
export async function updateNickname(nickname: string) {
  const { user } = await api<{ user: Me['user'] }>('/me', {
    method: 'PATCH',
    body: { nickname },
  });
  return user;
}

/**
 * 카카오 동의 화면으로 가는 시작 주소.
 * 앱은 카카오를 직접 부르지 않는다 — 서버가 열어주는 주소를 브라우저로 띄우고
 * 서버가 되돌려주는 주소에서 토큰만 꺼낸다. (server/src/routes/auth.ts)
 */
export function kakaoStartUrl(returnUrl: string) {
  return `${API_BASE}/auth/kakao/start?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/** 개발용 로그인. 서버가 DEV_LOGIN 을 켰을 때만 열려 있다. */
export async function devLogin(name: string) {
  const { token } = await api<{ token: string }>('/auth/dev', {
    method: 'POST',
    body: { name },
    token: null,
  });
  return token;
}
