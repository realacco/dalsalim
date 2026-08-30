import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * 서버 주소.
 *
 * 안드로이드 에뮬레이터는 `adb reverse tcp:4000 tcp:4000` 로 터널이 걸려 있어
 * localhost 를 그대로 쓸 수 있다. (npm run dev 가 자동으로 걸어준다)
 * 실기기에서 붙을 때만 EXPO_PUBLIC_API_URL 로 PC 의 LAN IP 를 넘기면 된다.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // Expo Go 로 붙은 실기기: 개발 서버 호스트를 그대로 재활용한다
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];

  if (host && host !== 'localhost' && host !== '127.0.0.1' && Platform.OS !== 'web') {
    return `http://${host}:4000`;
  }

  return 'http://localhost:4000';
}

export const API_BASE = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

type Options = { method?: string; body?: unknown; token?: string | null };

export async function api<T>(path: string, { method = 'GET', body, token }: Options = {}): Promise<T> {
  const effectiveToken = token !== undefined ? token : authToken;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', `서버에 닿지 못했어요.\n(${API_BASE})`);
  }

  const text = await response.text();
  const payload = text ? safeParse(text) : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code ?? 'UNKNOWN',
      payload?.message ?? '알 수 없는 오류가 생겼어요.',
    );
  }

  return payload as T;
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
