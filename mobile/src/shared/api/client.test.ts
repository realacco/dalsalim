import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// client 는 앱 주소를 고르려고 expo-constants 와 react-native 를 읽는다. 여기서는 그 둘이 필요 없다
vi.mock('expo-constants', () => ({ default: { expoConfig: null, expoGoConfig: null } }));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

import { ApiError, api, onUnauthorized, setAuthToken } from './client';
import { MESSAGES } from '@/shared/config/messages';

function respond(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('api() — 서버 통신의 한 곳', () => {
  beforeEach(() => {
    setAuthToken(null);
    onUnauthorized(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('성공하면 본문을 그대로 돌려준다', async () => {
    vi.stubGlobal('fetch', respond(200, { entry: { id: 'e1' } }));
    await expect(api<{ entry: { id: string } }>('/x')).resolves.toEqual({ entry: { id: 'e1' } });
  });

  it('토큰이 있으면 Authorization 헤더에 싣는다', async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal('fetch', fetchMock);
    setAuthToken('t0k3n');
    await api('/me');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t0k3n');
  });

  it('실패하면 서버의 { code, message } 를 그대로 든 ApiError 를 던진다', async () => {
    vi.stubGlobal(
      'fetch',
      respond(400, { code: 'REASON_REQUIRED', message: '사유를 적어주세요.' }),
    );
    const caught = await api('/x').catch((e: unknown) => e);
    expect(caught).toBeInstanceOf(ApiError);
    expect((caught as ApiError).status).toBe(400);
    expect((caught as ApiError).code).toBe('REASON_REQUIRED');
    expect((caught as ApiError).message).toBe('사유를 적어주세요.');
  });

  it('서버가 약속한 모양이 아니면 폴백 문구로 바꾼다 — 게이트웨이가 끼어들 수 있다', async () => {
    vi.stubGlobal('fetch', respond(502, '<html>Bad Gateway</html>'));
    const caught = (await api('/x').catch((e: unknown) => e)) as ApiError;
    expect(caught.code).toBe('UNKNOWN');
    expect(caught.message).toBe(MESSAGES.unknown);
  });

  it('서버에 닿지 못하면 NETWORK 이고 주소를 같이 알려준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    const caught = (await api('/x').catch((e: unknown) => e)) as ApiError;
    expect(caught.status).toBe(0);
    expect(caught.code).toBe('NETWORK');
    expect(caught.message).toContain(MESSAGES.network);
    expect(caught.message).toContain('http://');
  });

  it('★ 401 이면 등록된 처리기를 부르고, 그래도 오류는 던진다', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    vi.stubGlobal('fetch', respond(401, { code: 'UNAUTHORIZED', message: '로그인이 필요해요.' }));

    const caught = (await api('/me').catch((e: unknown) => e)) as ApiError;
    expect(handler).toHaveBeenCalledTimes(1);
    expect(caught.status).toBe(401);
  });

  it('401 이 아니면 처리기를 부르지 않는다', async () => {
    const handler = vi.fn();
    onUnauthorized(handler);
    vi.stubGlobal('fetch', respond(403, { code: 'OWNER_ONLY', message: '가족장만 할 수 있어요.' }));
    await api('/x').catch(() => undefined);
    expect(handler).not.toHaveBeenCalled();
  });
});
