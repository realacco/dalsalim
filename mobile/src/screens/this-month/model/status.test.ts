import { describe, it, expect } from 'vitest';
import { bookBadge, statusLabel, statusStyleKey } from './status';

describe('가족 진행 현황 표시', () => {
  it('제출했으면 "제출 완료"', () => {
    expect(statusLabel('SUBMITTED', null)).toBe('제출 완료');
    expect(statusStyleKey('SUBMITTED')).toBe('statusSubmitted');
  });

  it('작성 중이면 몇 단계인지 같이 보여준다', () => {
    expect(statusLabel('DRAFT', { step: 3, total: 7 })).toBe('작성 중 3/7');
    expect(statusLabel('DRAFT', null)).toBe('작성 중');
    expect(statusStyleKey('DRAFT')).toBe('statusDraft');
  });

  it('시작 안 한 사람은 흐리게', () => {
    expect(statusLabel('NONE', null)).toBe('시작 안 함');
    expect(statusStyleKey('NONE')).toBe('statusNone');
  });

  it('장부 배지는 완성이 아니면 남은 사람 수를 말한다', () => {
    expect(bookBadge('COMPLETE', 0)).toBe('완성');
    expect(bookBadge('OPEN', 2)).toBe('2명 남음');
  });
});
