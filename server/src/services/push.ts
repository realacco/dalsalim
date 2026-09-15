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

/** Expo 가 못 보냈다고 답한 한 통. 토큰은 사용자 데이터가 아니라 기기 주소라 로그에 실어도 된다 */
export type PushFailure = { to: string; error: string };

/**
 * 보내는 쪽. 실제로는 Expo 지만, 스모크는 기록만 하는 가짜를 꽂는다.
 * `dead` 는 지워야 할 토큰, `failed` 는 그 밖에 못 간 것 — 자격 증명 · 발신자 불일치처럼 설정이 틀린 것들이라
 * 조용히 삼키면 한 달에 한 번 오는 알림이 안 온 채로 "보냈다"고 적힌다. 로그로는 반드시 나가야 한다
 */
export type PushSender = (messages: PushMessage[]) => Promise<PushResult>;

/**
 * 한 번 보낸 결과.
 *  - `dead` 지울 토큰 · `failed` 못 간 기기 · `shortTickets` **표를 못 받은 통의 수**
 *
 * 셋 다 스케줄러가 한 곳에서 읽어 로그로 내보낸다. 여기서 직접 `console` 로 찍지 않는다 —
 * 서버 로그는 pino 한 줄기이고, 벗어난 줄은 "잘 보냈어요" 옆에 안 붙어서 상관관계를 잃는다
 */
export type PushResult = { dead: string[]; failed: PushFailure[]; shortTickets: number };

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
 * 표(ticket)의 오류를 둘로 가른다 — DeviceNotRegistered 는 토큰을 지울 근거(dead), 나머지는 로그에 남길 것(failed).
 * 어느 쪽도 다시 보내지 않는다. 같은 달엔 한 번뿐이고, 설정 문제는 사람이 고쳐야 다음 달에 간다.
 *
 * 실패의 결이 둘이라 다르게 다룬다.
 *  - **Expo 가 받고 거절한 것** (4xx · 200 에 errors 만) — 우리 요청이 틀린 것이라 다시 보내도 같다.
 *    그 청크 전부를 failed 로 눕히고 계속 간다. 던지면 스케줄러가 날이 바뀔 때까지 1분마다 같은 요청을 한다.
 *  - **Expo 에 못 닿은 것** (5xx · 타임아웃 · 네트워크) — 던진다. 표시가 안 적히고 다음 틱에 다시 시도한다.
 *    잠깐의 장애라면 그게 맞고, 종일 이어지면 종일 다시 시도한다 — 한 달에 한 번 오는 알림은 안 오는 쪽이 더 나쁘다.
 */
export const sendViaExpo: PushSender = async (messages) => {
  const dead: string[] = [];
  const failed: PushFailure[] = [];
  /** 짝을 못 찾은 통. dead 도 failed 도 아니라 세지 않으면 "잘 보냈다"로 지나간다 */
  let shortTickets = 0;

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
    /*
      429 는 4xx 인데도 못 닿은 쪽에 세운다. 나머지 4xx 를 눕히는 근거는 "우리 요청이 틀린 것이라
      다시 보내도 같다" 인데, rate limit 은 요청이 틀린 게 아니라 잠깐 빨랐던 것이라 다음 틱이면 통과한다.
      그 근거가 성립하지 않는 유일한 4xx 다
    */
    if (response.status >= 500 || response.status === 429) {
      throw new Error(`Expo push 응답 ${response.status}`);
    }

    const parsed = (await response.json().catch(() => ({}))) as ExpoPushResponse;
    if (!response.ok || !Array.isArray(parsed.data)) {
      const error = parsed.errors?.[0]?.code ?? `HTTP ${response.status}`;
      failed.push(...chunk.map(({ to }) => ({ to, error })));
      continue;
    }
    /*
      표가 모자라면 짝을 못 찾은 통들이 dead 도 failed 도 아닌 채 성공으로 지나가고
      settlementNotifiedFor 는 적힌다 — 그 달 알림을 못 받은 사람이 어디에도 안 남는다.
      Expo 가 실제로 그러지는 않지만, 그렇게 되는 날 단서가 이 수 하나뿐이다
    */
    if (parsed.data.length < chunk.length) shortTickets += chunk.length - parsed.data.length;
    parsed.data.forEach((ticket, index) => {
      if (ticket.status !== 'error') return;
      /*
        Expo 는 보낸 통수만큼 표를 돌려주지만, 어긋났을 때 `chunk[index].to` 가 터지면
        그 TypeError 가 이 함수 밖으로 던져진다 — 스케줄러는 그걸 "Expo 에 못 닿음" 으로 읽어
        표시를 안 적고 날이 바뀔 때까지 매분 다시 보낸다. 이미 받은 사람에게 진짜 푸시가 계속 간다.
        표가 남아돌면 짝이 없는 것이니 버린다. 위에서 정한 "받고 거절한 것은 던지지 않는다" 와 같은 결이다
      */
      const to = chunk[index]?.to;
      if (!to) return;
      if (ticket.details?.error === 'DeviceNotRegistered') dead.push(to);
      else failed.push({ to, error: ticket.details?.error ?? ticket.message ?? 'unknown' });
    });
  }

  return { dead, failed, shortTickets };
};
