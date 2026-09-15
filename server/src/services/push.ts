// 기능: F-FAM-10
import { env } from '../env.js';
import { prisma } from '../lib/db.js';

/**
 * 폰으로 보내는 알림 한 통. 밖(Expo → FCM)으로 나가는 것은 이 모양이 전부다 —
 * 토큰 · 제목 · 본문 · 열 화면. 금액·기록·이름은 싣지 않는다 (CLAUDE.md 보안 규칙의 예외 조건).
 */
export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
};

/** 보내는 쪽. 실제로는 Expo 지만, 스모크는 기록만 하는 가짜를 꽂는다 */
export type PushSender = (messages: PushMessage[]) => Promise<{ dead: string[] }>;

/** 같은 토큰이 다른 계정으로 로그인하면 그 계정의 것이 된다 — 폰은 사람의 것이고 한 폰에는 한 계정이다 */
export function registerPushToken(userId: string, token: string, platform: string) {
  return prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { userId, platform },
  });
}

export function removePushToken(userId: string, token: string) {
  return prisma.pushToken.deleteMany({ where: { userId, token } });
}

/** Expo 가 "이 기기는 없다"고 답한 토큰. 앱을 지웠거나 알림을 껐다 — 다시 보내봐야 소용없다 */
export async function removeDeadTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  await prisma.pushToken.deleteMany({ where: { token: { in: tokens } } });
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo 가 한 번에 받는 최대 */
const EXPO_CHUNK = 100;
/** 스케줄러가 1분마다 돌고 겹침을 막으므로, 한 전송이 이보다 오래 매달리면 틱이 통째로 밀린다 */
const EXPO_TIMEOUT_MS = 10_000;

type ExpoTicket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };
/** Expo 는 요청 전체가 잘못됐을 때 200 에 errors 만 담아 보낸다 — data 가 없다 */
type ExpoPushResponse = { data?: ExpoTicket[]; errors?: { code?: string; message?: string }[] };

/**
 * Expo Push Service 로 보낸다. Expo 가 FCM(안드로이드) · APNs(iOS) 에 넘긴다.
 * 표(ticket)에서 DeviceNotRegistered 만 골라 돌려준다 — 나머지 실패는 다음 달에 다시 시도되는 것뿐이라 삼킨다.
 */
export const sendViaExpo: PushSender = async (messages) => {
  const dead: string[] = [];

  for (let start = 0; start < messages.length; start += EXPO_CHUNK) {
    const chunk = messages.slice(start, start + EXPO_CHUNK);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(EXPO_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(env.expoAccessToken ? { Authorization: `Bearer ${env.expoAccessToken}` } : {}),
      },
      body: JSON.stringify(
        chunk.map((message) => ({ ...message, sound: 'default', channelId: 'default' })),
      ),
    });
    if (!response.ok) throw new Error(`Expo push 응답 ${response.status}`);

    const parsed = (await response.json()) as ExpoPushResponse;
    if (!Array.isArray(parsed.data)) {
      throw new Error(`Expo push 거절: ${JSON.stringify(parsed.errors ?? parsed)}`);
    }
    parsed.data.forEach((ticket, index) => {
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        dead.push(chunk[index].to);
      }
    });
  }

  return { dead };
};
