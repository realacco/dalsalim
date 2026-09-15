import { afterEach, describe, expect, it, vi } from 'vitest';

import { type PushMessage, sendViaExpo } from './push.js';

/** Expo 응답을 흉내 낸다. 실제 exp.host 에는 닿지 않는다 */
function expoAnswers(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const message = (to: string): PushMessage => ({ to, title: '달살림', body: '정산일이에요' });

afterEach(() => vi.unstubAllGlobals());

describe('F-FAM-10 Expo 전송 결과 가르기', () => {
  it('★ DeviceNotRegistered 는 지울 토큰(dead), 그 밖의 오류는 로그로 남길 것(failed) 으로 가른다', async () => {
    expoAnswers({
      data: [
        { status: 'ok' },
        { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', message: 'bad key', details: { error: 'InvalidCredentials' } },
        { status: 'error', message: 'no details at all' },
      ],
    });

    const result = await sendViaExpo(
      ['a', 'b', 'c', 'd'].map((to) => message(`ExponentPushToken[${to}]`)),
    );

    expect(result.dead).toEqual(['ExponentPushToken[b]']);
    expect(result.failed).toEqual([
      { to: 'ExponentPushToken[c]', error: 'InvalidCredentials' },
      { to: 'ExponentPushToken[d]', error: 'no details at all' },
    ]);
  });

  it('요청 전체가 거절되면(errors 만 있는 200) 던진다 — 조용히 "보냈다" 가 되면 안 된다', async () => {
    expoAnswers({ errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS', message: '...' }] });
    await expect(sendViaExpo([message('ExponentPushToken[a]')])).rejects.toThrow('거절');
  });

  it('HTTP 오류도 던진다', async () => {
    expoAnswers({}, 503);
    await expect(sendViaExpo([message('ExponentPushToken[a]')])).rejects.toThrow('503');
  });

  it('100통씩 끊어 보낸다 — Expo 가 한 번에 받는 최대', async () => {
    const fetchMock = expoAnswers({ data: Array.from({ length: 100 }, () => ({ status: 'ok' })) });
    await sendViaExpo(Array.from({ length: 150 }, (_, i) => message(`ExponentPushToken[${i}]`)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
