import { describe, expect, it } from 'vitest';

import { approvedFamilyId, exitWithoutRequests, waitingFamilyIds } from './pending';

/**
 * 이 판정이 「목록에 뭐라도 있나」였을 때 실제로 난 버그 —
 * 이미 가족이 있는 사람이 다른 가족에 요청하면, 대기 화면에서 「승인됐는지 확인하기」를
 * 누르는 순간 **원래 가족을 승인 결과로 읽고** 갈아탄 뒤 탭으로 되돌려 보냈다.
 * 그 화면에서 할 일이 그 버튼뿐이라 첫 시도에 걸린다.
 */
describe('approvedFamilyId', () => {
  it('★ F-FAM-04 기다리던 가족이 ACTIVE 로 나타나면 그 가족이다', () => {
    expect(approvedFamilyId(['f-new'], ['f-new'])).toBe('f-new');
  });

  it('★ F-FAM-04 원래 있던 가족은 승인이 아니다 — 기다리던 가족이 아니다', () => {
    expect(approvedFamilyId(['f-new'], ['f-old'])).toBeNull();
  });

  it('★ F-FAM-04 원래 가족이 있어도 기다리던 그 가족으로 판정한다', () => {
    expect(approvedFamilyId(['f-new'], ['f-old', 'f-new'])).toBe('f-new');
  });

  it('★ F-FAM-04 여러 건을 기다리면 요청한 순서로 먼저 승인된 것을 준다', () => {
    expect(approvedFamilyId(['f-1', 'f-2'], ['f-old', 'f-2'])).toBe('f-2');
    expect(approvedFamilyId(['f-1', 'f-2'], ['f-1', 'f-2'])).toBe('f-1');
  });

  it('가족이 하나도 없던 사람은 목록이 비었다가 한 개가 된다', () => {
    expect(approvedFamilyId(['f-new'], [])).toBeNull();
    expect(approvedFamilyId(['f-new'], ['f-new'])).toBe('f-new');
  });

  it('기다리는 것이 없으면 무엇이 ACTIVE 든 승인이 아니다', () => {
    expect(approvedFamilyId([], ['f-old'])).toBeNull();
  });
});

describe('waitingFamilyIds', () => {
  it('요청한 순서를 그대로 둔다', () => {
    const request = (id: string) => ({
      membershipId: `m-${id}`,
      displayName: '나',
      requestedAt: null,
      family: { id, name: id },
    });
    expect(waitingFamilyIds([request('f-1'), request('f-2')])).toEqual(['f-1', 'f-2']);
  });
});

describe('exitWithoutRequests', () => {
  it('★ F-FAM-04 거절돼도 원래 가족이 있으면 그 가족으로 돌아간다', () => {
    expect(exitWithoutRequests(true)).toBe('/(tabs)');
  });

  it('가족이 없으면 참여할 길로 돌아간다', () => {
    expect(exitWithoutRequests(false)).toBe('/onboarding');
  });
});
