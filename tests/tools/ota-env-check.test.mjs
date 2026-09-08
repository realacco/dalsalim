import { describe, expect, it } from 'vitest';

import { envLoaded } from '../../scripts/ota-env-check.mjs';

/**
 * 이 검사는 **발행 뒤**에 돈다. 오탐이면 되돌릴 것도 없이 빨간 실행만 남고,
 * 그러면 다음부터 "또 그 오탐" 으로 읽혀 아무도 안 본다.
 * 놓치면 주소 없는 번들이 가족 폰에 그대로 있다.
 * 네이티브 가드와 같은 이유로 양쪽을 같은 무게로 못박는다.
 *
 * 아래 두 줄은 시행착오 1-9 때 실제로 찍혔던 로그다.
 */
const 실림 =
  'Environment variables with visibility "Plain text" loaded from the "preview" environment on EAS: EXPO_PUBLIC_API_URL.';
const 안실림 =
  'No environment variables with visibility "Plain text" and "Sensitive" found for the "preview" environment on EAS.';

const VAR = 'EXPO_PUBLIC_API_URL';

describe('envLoaded', () => {
  it('실린 로그를 통과시킨다', () => {
    expect(envLoaded(`${실림}\nUpdate published`, { variable: VAR })).toBe(true);
  });

  it('안 실린 로그를 막는다 — 1-9 가 이 줄이었다', () => {
    expect(envLoaded(`${안실림}\nUpdate published`, { variable: VAR })).toBe(false);
  });

  /**
   * 이게 핵심이다. 사람이 친 발행 메시지도 로그에 그대로 찍히므로,
   * 변수 이름만 찾으면 **그 변수를 만지느라 쏘는 발행**에서 검사가 눈을 감는다.
   */
  it('발행 메시지에 변수 이름이 들어 있어도 속지 않는다', () => {
    const log = [안실림, `message: ${VAR} 주소를 새 도메인으로 교체`, 'Update published'].join(
      '\n',
    );
    expect(envLoaded(log, { variable: VAR })).toBe(false);
  });

  it('빈 로그를 막는다', () => {
    expect(envLoaded('', { variable: VAR })).toBe(false);
  });

  it('다른 변수만 실렸으면 막는다', () => {
    const log =
      'Environment variables ... loaded from the "preview" environment on EAS: OTHER_VAR.';
    expect(envLoaded(log, { variable: VAR })).toBe(false);
  });

  describe('환경 이름까지 볼 때 — 채널과 환경이 어긋나면 엉뚱한 주소가 실린다', () => {
    it('같은 환경이면 통과한다', () => {
      expect(envLoaded(실림, { variable: VAR, environment: 'preview' })).toBe(true);
    });

    it('다른 환경에서 실렸으면 막는다', () => {
      expect(envLoaded(실림, { variable: VAR, environment: 'production' })).toBe(false);
    });
  });

  /** 성공과 실패가 한 로그에 다 있어도 성공 줄이 있으면 실린 것이다 */
  it('여러 줄 중 한 줄만 맞아도 통과한다', () => {
    expect(
      envLoaded(`빌드 시작\n${실림}\n${안실림.replace('preview', 'development')}`, {
        variable: VAR,
        environment: 'preview',
      }),
    ).toBe(true);
  });
});
