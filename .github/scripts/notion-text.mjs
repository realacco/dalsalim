/**
 * Notion 블록 → 읽을 수 있는 텍스트. 순수 함수만 둔다 (`tests/tools/notion-text.test.mjs`).
 *
 * 떼어낸 이유: 여기가 깨지면 예외가 나는 게 아니라 **빈 문자열이나 이상한 텍스트**가 나온다.
 * 리뷰 컨텍스트가 조용히 비어도 워크플로는 초록이고, 리뷰는 명세를 못 본 채 그럴듯하게 돈다.
 * 이 저장소가 이미 세 번 당한 "틀린 값이 아니라 빈 결과" 함정과 같은 모양이다.
 */

/** 인덱스의 Notion 링크에서 32자리 페이지 id. 못 찾으면 null */
export function pageIdFrom(url) {
  return /([0-9a-f]{32})/.exec(url ?? '')?.[1] ?? null;
}

function richText(rich) {
  return Array.isArray(rich) ? rich.map((r) => r?.plain_text ?? '').join('') : '';
}

/** 블록 하나 → 한 줄. 텍스트가 없으면 빈 문자열(호출부가 걸러낸다) */
export function blockText(block) {
  const type = block?.type;
  if (!type) return '';

  if (type === 'table_row') {
    const cells = (block.table_row?.cells ?? []).map((c) => richText(c).trim() || '—');
    return cells.length ? `| ${cells.join(' | ')} |` : '';
  }

  const text = richText(block[type]?.rich_text);
  if (!text.trim()) return '';

  if (type.startsWith('heading_')) return `#### ${text}`;
  if (type === 'bulleted_list_item') return `- ${text}`;
  if (type === 'numbered_list_item') return `1. ${text}`;
  if (type === 'quote') return `> ${text}`;
  if (type === 'code') return `\`\`\`\n${text}\n\`\`\``;
  return text;
}
