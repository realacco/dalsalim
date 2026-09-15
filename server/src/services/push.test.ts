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

  it('Expo 가 요청 전체를 거절하면(errors 만 있는 200) 그 청크 전부가 failed — 다시 보내도 같은 답이라 던지지 않는다', async () => {
    expoAnswers({ errors: [{ code: 'PUSH_TOO_MANY_EXPERIENCE_IDS', message: '...' }] });
    const result = await sendViaExpo(['a', 'b'].map((to) => message(`ExponentPushToken[${to}]`)));
    expect(result.failed.map((f) => f.error)).toEqual([
      'PUSH_TOO_MANY_EXPERIENCE_IDS',
      'PUSH_TOO_MANY_EXPERIENCE_IDS',
    ]);
  });

  it('4xx 도 같다 — 자격 증명이 틀린 채로 날이 바뀔 때까지 매분 두드리면 안 된다', async () => {
    expoAnswers({ errors: [{ code: 'UNAUTHORIZED' }] }, 401);
    const result = await sendViaExpo([message('ExponentPushToken[a]')]);
    expect(result.failed).toEqual([{ to: 'ExponentPushToken[a]', error: 'UNAUTHORIZED' }]);
  });

  it('★ 5xx 는 던진다 — 표시를 안 적어야 다음 틱에 다시 간다. 잠깐 죽은 Expo 때문에 한 달 알림을 잃지 않는다', async () => {
    expoAnswers({}, 503);
    await expect(sendViaExpo([message('ExponentPushToken[a]')])).rejects.toThrow('503');
  });

  it('★ 표가 보낸 통수보다 많아도 던지지 않는다 — 여기서 터지면 스케줄러가 못 닿은 줄 알고 매분 다시 보낸다', async () => {
    expoAnswers({
      data: [
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'InvalidCredentials' } },
      ],
    });

    const result = await sendViaExpo([message('ExponentPushToken[a]')]);

    expect(result.dead).toEqual(['ExponentPushToken[a]']);
    expect(result.failed).toEqual([]);
    expect(result.shortTickets).toBe(0); // 남아도는 쪽은 짝 없는 통이 아니다
  });

  it('★ 표가 모자라면 그 수를 세어 돌려준다 — 스케줄러가 "보냈어요" 대신 경고로 찍는 근거다', async () => {
    expoAnswers({ data: [{ status: 'ok' }] });
    const result = await sendViaExpo(
      ['a', 'b', 'c'].map((to) => message(`ExponentPushToken[${to}]`)),
    );
    expect(result.shortTickets).toBe(2);
    expect(result.failed).toEqual([]);
  });

  it('100통씩 끊어 보낸다 — Expo 가 한 번에 받는 최대', async () => {
    const fetchMock = expoAnswers({ data: Array.from({ length: 100 }, () => ({ status: 'ok' })) });
    await sendViaExpo(Array.from({ length: 150 }, (_, i) => message(`ExponentPushToken[${i}]`)));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
