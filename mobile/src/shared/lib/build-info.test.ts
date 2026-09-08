import { describe, it, expect } from 'vitest';
import { formatBuildInfo } from './build-info';

describe('번들 표시', () => {
  it('OTA 로 받은 번들은 id 앞자리와 발행 시각을 보여준다', () => {
    expect(
      formatBuildInfo({
        version: '0.1.0',
        updateId: 'b6573a8e-6b84-412f-a2d7-4e5ed2a08143',
        createdAt: new Date(2026, 8, 8, 20, 34),
        isEmbedded: false,
      }),
    ).toBe('v0.1.0 · 업데이트 b6573a8 (9월 8일 20:34)');
  });

  it('분은 두 자리로 채운다', () => {
    expect(
      formatBuildInfo({
        version: '0.1.0',
        updateId: 'abcdefg1234',
        createdAt: new Date(2026, 0, 3, 9, 5),
        isEmbedded: false,
      }),
    ).toBe('v0.1.0 · 업데이트 abcdefg (1월 3일 9:05)');
  });

  /*
    ↓ 이 두 경우를 가르는 것이 이 줄의 존재 이유다.
    "설치한 그대로" 가 보이면 OTA 가 아직 이 폰에 안 닿은 것이다.
  */
  it('APK 에 구워진 번들로 떴으면 그렇다고 말한다', () => {
    expect(
      formatBuildInfo({ version: '0.1.0', updateId: null, createdAt: null, isEmbedded: true }),
    ).toBe('v0.1.0 · 설치한 그대로');
  });

  /*
    ↓ 실기기 프로덕션에서 OTA 를 아직 안 받은 상태가 정확히 이 조합이다.
    expo-updates 는 **내장 번들에도 id 를 준다** — 그래서 isEmbeddedLaunch 가 따로 있다.
    id 만 보고 판단하면 "받았다"로 잘못 읽고, 이 줄을 만든 이유가 사라진다.
  */
  it('내장 번들에 id 가 붙어 와도 설치한 그대로로 본다', () => {
    expect(
      formatBuildInfo({
        version: '0.1.0',
        updateId: 'b6573a8e-6b84',
        createdAt: new Date(2026, 8, 8, 20, 34),
        isEmbedded: true,
      }),
    ).toBe('v0.1.0 · 설치한 그대로');
  });

  it('업데이트로 떴다고 표시돼도 id 가 없으면 설치한 그대로로 본다', () => {
    expect(
      formatBuildInfo({ version: '0.1.0', updateId: null, createdAt: null, isEmbedded: false }),
    ).toBe('v0.1.0 · 설치한 그대로');
  });

  it('발행 시각을 모르면 id 만 보여준다', () => {
    expect(
      formatBuildInfo({
        version: '0.1.0',
        updateId: 'b6573a8e-6b84',
        createdAt: null,
        isEmbedded: false,
      }),
    ).toBe('v0.1.0 · 업데이트 b6573a8');
  });

  it('버전을 못 읽어도 빈 줄이 되지 않는다', () => {
    expect(
      formatBuildInfo({ version: null, updateId: null, createdAt: null, isEmbedded: true }),
    ).toBe('설치한 그대로');
  });
});
