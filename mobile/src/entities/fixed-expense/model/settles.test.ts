import { describe, it, expect } from 'vitest';
import { defaultSettles } from './settles';
import { CATEGORIES } from '@/shared/model/types';

describe('F-FIX-07 defaultSettles (앱) — 등록 시트의 스위치 기본값', () => {
  it('생활비면 켜진다', () => {
    expect(defaultSettles('생활비')).toBe(true);
  });

  it('나머지 분류는 꺼진다', () => {
    for (const category of CATEGORIES.filter((c) => c !== '생활비')) {
      expect(defaultSettles(category)).toBe(false);
    }
  });
});
