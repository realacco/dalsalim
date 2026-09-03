import type { BookView } from '@/entities/book';

type MemberStatus = BookView['members'][number]['status'];
type Progress = BookView['members'][number]['progress'];

/** 가족 진행 현황 한 줄 — "제출 완료" · "작성 중 3/7" · "시작 안 함" */
export function statusLabel(status: MemberStatus, progress: Progress): string {
  if (status === 'SUBMITTED') return '제출 완료';
  if (status === 'DRAFT')
    return progress ? `작성 중 ${progress.step}/${progress.total}` : '작성 중';
  return '시작 안 함';
}

/**
 * 상태별 색은 스타일 시트에서 고른다.
 * 렌더 중에 useTheme() 을 조건부로 부르면 훅 순서가 깨진다 —
 * 실제로 "React has detected a change in the order of Hooks" 가 났다.
 */
export function statusStyleKey(status: MemberStatus) {
  if (status === 'SUBMITTED') return 'statusSubmitted' as const;
  if (status === 'DRAFT') return 'statusDraft' as const;
  return 'statusNone' as const;
}

/** 장부 배지 — 완성이면 "완성", 아니면 몇 명이 남았는지 */
export function bookBadge(bookStatus: BookView['book']['status'], remaining: number): string {
  return bookStatus === 'COMPLETE' ? '완성' : `${remaining}명 남음`;
}
