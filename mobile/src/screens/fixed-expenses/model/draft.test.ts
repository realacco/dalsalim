import { describe, it, expect } from 'vitest';
import { draftFromItem, draftToInput, emptyDraft, sanitizeDay, validateDraft } from './draft';

describe('고정비 편집 초안', () => {
  it('새 항목은 주거 분류에 빈 값으로 시작한다', () => {
    expect(emptyDraft('m1')).toEqual({
      id: null,
      membershipId: 'm1',
      name: '',
      category: '주거',
      defaultAmount: null,
      dayOfMonth: '',
    });
  });

  it('기존 항목을 열면 결제일이 입력창 문자열이 된다', () => {
    const draft = draftFromItem(
      { id: 'f1', name: '월세', category: '주거', defaultAmount: 600000, dayOfMonth: 25 },
      'm1',
    );
    expect(draft.dayOfMonth).toBe('25');
    expect(draft.id).toBe('f1');
  });

  it('결제일이 없는 항목은 빈 칸으로 연다', () => {
    const draft = draftFromItem(
      { id: 'f2', name: '통신비', category: '통신', defaultAmount: 55000, dayOfMonth: null },
      'm1',
    );
    expect(draft.dayOfMonth).toBe('');
  });
});

describe('결제일 입력 가공', () => {
  it('숫자 두 자리까지만 남긴다', () => {
    expect(sanitizeDay('25일')).toBe('25');
    expect(sanitizeDay('123')).toBe('12');
    expect(sanitizeDay('abc')).toBe('');
  });
});

describe('저장 전 검사', () => {
  const base = { ...emptyDraft('m1'), name: '월세' };

  it('이름이 비어 있으면 막는다', () => {
    expect(validateDraft({ ...base, name: '  ' })).toBe('항목 이름을 적어주세요.');
  });

  it('결제일은 비워도 되고, 1~31 이면 통과한다', () => {
    expect(validateDraft({ ...base, dayOfMonth: '' })).toBeNull();
    expect(validateDraft({ ...base, dayOfMonth: '1' })).toBeNull();
    expect(validateDraft({ ...base, dayOfMonth: '31' })).toBeNull();
  });

  it('결제일이 0 이거나 32 이상이면 막는다', () => {
    expect(validateDraft({ ...base, dayOfMonth: '0' })).toBe('결제일은 1에서 31 사이여야 해요.');
    expect(validateDraft({ ...base, dayOfMonth: '32' })).toBe('결제일은 1에서 31 사이여야 해요.');
  });
});

describe('서버로 보낼 모양', () => {
  it('금액을 안 적었으면 0 원, 결제일이 비었으면 null', () => {
    expect(draftToInput({ ...emptyDraft('m1'), name: ' 월세 ' })).toEqual({
      name: '월세',
      category: '주거',
      defaultAmount: 0,
      dayOfMonth: null,
    });
  });

  it('적은 값은 숫자로 넘어간다', () => {
    expect(
      draftToInput({ ...emptyDraft('m1'), name: '월세', defaultAmount: 600000, dayOfMonth: '25' }),
    ).toEqual({ name: '월세', category: '주거', defaultAmount: 600000, dayOfMonth: 25 });
  });
});
