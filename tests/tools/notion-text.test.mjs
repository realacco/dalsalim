import { describe, expect, it } from 'vitest';

import { blockText, pageIdFrom } from '../../.github/scripts/notion-text.mjs';

/**
 * PR 리뷰가 기능 정의서 본문을 읽을 때 쓰는 변환기.
 *
 * 여기가 깨지면 예외가 아니라 **빈 컨텍스트**가 나온다. 워크플로는 초록이고,
 * 리뷰는 명세를 못 본 채로 그럴듯하게 돈다 — 그게 제일 나쁜 실패다.
 */

const rich = (text) => [{ plain_text: text }];

describe('pageIdFrom — 인덱스 링크에서 페이지 id 를 뽑는다', () => {
  it('실제 인덱스에 있는 형태에서 32자리를 뽑는다', () => {
    expect(pageIdFrom('https://app.notion.com/p/3d3a433436ef81dea387dad3b04ea1f8')).toBe(
      '3d3a433436ef81dea387dad3b04ea1f8',
    );
  });

  it('id 가 없거나 값이 비면 null 이다 — 호출부가 건너뛴다', () => {
    expect(pageIdFrom('https://app.notion.com/p/none')).toBeNull();
    expect(pageIdFrom(undefined)).toBeNull();
  });
});

describe('blockText — 블록 하나를 한 줄로', () => {
  it('문단·제목·목록·인용을 각자의 모양으로 옮긴다', () => {
    expect(
      blockText({ type: 'paragraph', paragraph: { rich_text: rich('가족장만 승인한다') } }),
    ).toBe('가족장만 승인한다');
    expect(blockText({ type: 'heading_2', heading_2: { rich_text: rich('동작 정책') } })).toBe(
      '#### 동작 정책',
    );
    expect(
      blockText({
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: rich('승인 시 ACTIVE') },
      }),
    ).toBe('- 승인 시 ACTIVE');
    expect(blockText({ type: 'quote', quote: { rich_text: rich('기획서 3장') } })).toBe(
      '> 기획서 3장',
    );
  });

  it('★ 표를 마크다운 행으로 옮긴다 — 기능 정의서 본문이 대부분 표다', () => {
    const row = {
      type: 'table_row',
      table_row: { cells: [rich('메뉴 경로'), rich('가족 탭 > 참여 요청')] },
    };
    expect(blockText(row)).toBe('| 메뉴 경로 | 가족 탭 > 참여 요청 |');
  });

  it('빈 칸은 — 로 채운다. 칸이 사라지면 표가 밀린다', () => {
    const row = { type: 'table_row', table_row: { cells: [rich('시스템 알림'), []] } };
    expect(blockText(row)).toBe('| 시스템 알림 | — |');
  });

  it('★ 여러 조각으로 쪼개진 rich_text 를 이어 붙인다 — 서식이 걸리면 조각난다', () => {
    const block = {
      type: 'paragraph',
      paragraph: {
        rich_text: [
          { plain_text: '금액이 ' },
          { plain_text: '달라지면' },
          { plain_text: ' 막는다' },
        ],
      },
    };
    expect(blockText(block)).toBe('금액이 달라지면 막는다');
  });

  it('내용 없는 블록과 모르는 형태는 빈 문자열이다 — 던지지 않는다', () => {
    expect(blockText({ type: 'divider', divider: {} })).toBe('');
    expect(blockText({ type: 'paragraph', paragraph: { rich_text: [] } })).toBe('');
    expect(blockText({ type: 'image', image: { file: {} } })).toBe('');
    expect(blockText({})).toBe('');
    expect(blockText(null)).toBe('');
  });
});
