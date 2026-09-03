import { describe, it, expect } from 'vitest';
import { ERRORS, type ErrorCode, messageFor, statusFor } from './messages.js';

const codes = Object.keys(ERRORS) as ErrorCode[];

/** 함수형 메시지는 대표 입력 둘로 펼친다 — 빈 detail 과 채운 detail */
function everyMessage(): { code: ErrorCode; text: string }[] {
  return codes.flatMap((code) => [
    { code, text: messageFor(code) },
    { code, text: messageFor(code, '월세, 통신비') },
  ]);
}

describe('에러 메시지 사전 — 말투 규칙 (CLAUDE.md)', () => {
  it('★ 전부 해요체로 끝난다 — 화면에 그대로 뜨는 문장이다', () => {
    // 항목 이름이 뒤에 붙는 형태("사유가 비어 있어요: 월세")는 문장 본체만 본다
    const wrong = codes.filter((code) => !/요[.!]?(: .*)?$/.test(messageFor(code).trim()));
    expect(wrong).toEqual([]);
  });

  it('항목 이름이 붙는 메시지도 문장 본체는 해요체다', () => {
    const wrong = everyMessage().filter(({ text }) => !/요[.!]?(: .*)?$/.test(text.trim()));
    expect(wrong).toEqual([]);
  });

  it('★ ~습니다 · ~입니다 를 쓰지 않는다', () => {
    const wrong = everyMessage().filter(({ text }) => /니다/.test(text));
    expect(wrong).toEqual([]);
  });

  it('영어 문장이 섞여 있지 않다', () => {
    // 코드 이름(YYYY-MM 같은 형식 설명)은 허용하되, 영어 단어가 넷 이상 이어지면 잘못 들어온 것이다
    const wrong = everyMessage().filter(({ text }) => /([A-Za-z]+\s+){3,}[A-Za-z]+/.test(text));
    expect(wrong).toEqual([]);
  });

  it('메시지가 비어 있는 코드가 없다', () => {
    const empty = everyMessage().filter(({ text }) => text.trim().length < 5);
    expect(empty).toEqual([]);
  });
});

describe('에러 코드 — 앱과 스모크가 분기하는 계약', () => {
  it('★ 스모크와 앱이 보는 코드는 계속 있어야 한다', () => {
    // 여기서 이름을 바꾸면 스모크(code 로 검증)와 앱이 동시에 갈라진다
    for (const code of [
      'REASON_REQUIRED',
      'TRANSFER_OWNER_FIRST',
      'PENDING_APPROVAL',
      'ALREADY_REQUESTED',
      'RATE_LIMITED',
      'UNAUTHORIZED',
      'VALIDATION',
      'INTERNAL',
    ]) {
      expect(codes).toContain(code);
    }
  });

  it('상태코드는 HTTP 의미와 맞는다', () => {
    const notFound = codes.filter((c) => c.endsWith('_NOT_FOUND'));
    for (const code of notFound) expect(statusFor(code)).toBe(404);
    for (const code of ['ALREADY_MEMBER', 'ALREADY_REQUESTED'] as const) {
      expect(statusFor(code)).toBe(409);
    }
    expect(statusFor('RATE_LIMITED')).toBe(429);
    expect(statusFor('INTERNAL')).toBe(500);
  });

  it('★ REASON_REQUIRED 는 항목 이름이 있으면 그것을 붙여서 말한다 (제출), 없으면 줄 저장 문장', () => {
    expect(messageFor('REASON_REQUIRED')).toContain('금액이 달라졌어요');
    expect(messageFor('REASON_REQUIRED', '월세, 통신비')).toBe('사유가 비어 있어요: 월세, 통신비');
  });

  it('INCOMPLETE 는 항목 이름이 없어도 문장이 된다', () => {
    expect(messageFor('INCOMPLETE')).toMatch(/요\.$/);
    expect(messageFor('INCOMPLETE', '월세')).toBe('아직 적지 않은 항목이 있어요: 월세');
  });
});
