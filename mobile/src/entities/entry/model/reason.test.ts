import { describe, it, expect } from 'vitest';
import { needsReason } from './reason';

/** 종류를 안 적으면 고정비 줄이다 */
function judge(
  plannedAmount: number | null,
  actualAmount: number | null,
  kind: 'FIXED' | 'SETTLEMENT' = 'FIXED',
) {
  return needsReason({ kind, plannedAmount, actualAmount });
}

/**
 * 앱 쪽 사본. 최종 판정은 서버가 하고 여기는 [다음] 버튼을 잠그는 UX 용이다.
 * 서버와 결과가 갈리면 "저장은 되는데 다음이 안 눌린다"(또는 그 반대)가 된다.
 * 두 구현이 실제로 같은지는 tests/contract 가 본다.
 */
describe('F-ENT-04 needsReason (앱) — 위저드가 [다음] 을 잠글지 정한다', () => {
  it('기본값과 같으면 묻지 않는다', () => {
    expect(judge(120000, 120000)).toBe(false);
  });

  it('★ 달라지면 사유가 필요하다', () => {
    expect(judge(120000, 135000)).toBe(true);
  });

  it('★ 되돌리면 다시 필요 없어진다', () => {
    expect(judge(120000, 120000)).toBe(false);
  });

  it('비교 대상이 없으면 묻지 않는다 — 첫 달과 추가 지출', () => {
    expect(judge(null, 135000)).toBe(false);
    expect(judge(120000, null)).toBe(false);
    expect(judge(null, null)).toBe(false);
  });

  it('★ 0 원으로 적은 것은 안 적은 것이 아니다', () => {
    expect(judge(120000, 0)).toBe(true);
  });

  it('★ F-ENT-11 결산 줄은 금액이 달라도 [다음] 을 잠그지 않는다', () => {
    expect(judge(500000, 350000, 'SETTLEMENT')).toBe(false);
    expect(judge(500000, 620000, 'SETTLEMENT')).toBe(false);
  });
});
