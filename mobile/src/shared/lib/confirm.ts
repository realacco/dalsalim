/**
 * 확인 다이얼로그 — 되돌리기 어려운 동작 앞에 세우는 유일한 방법이다.
 *
 * 규칙 (CLAUDE.md 실패 표현 규약)
 *  - 취소 버튼이 항상 있고, 항상 왼쪽이다
 *  - 실행 버튼은 제목의 동사를 그대로 쓴다. "확인" · "예" 는 쓰지 않는다 — 무엇을 확인하는지 안 보인다
 *  - 되돌리기 어려우면 destructive
 *
 * 이 파일은 **무엇을 물을지**만 안다. 어떻게 생겼는지는 shared/ui 의 ConfirmHost 가 정한다.
 * 그렇게 갈라둔 덕에 여기는 react-native 를 임포트하지 않아 1층에서 테스트된다.
 */

export type ConfirmOptions = {
  /** 동사구로 끝나는 제목 — "가족장 넘기기", "요청 취소" */
  title: string;
  /** 누르면 무슨 일이 생기는지. 되돌릴 수 있는지까지 말한다 */
  body: string;
  /** 실행 버튼 글자. 제목의 동사를 그대로 쓴다 — "넘기기", "취소하기" */
  confirmLabel: string;
  /** 되돌리기 어려운 동작이면 true. 실행 버튼이 붉게 표시된다 */
  destructive?: boolean;
  cancelLabel?: string;
  onConfirm: () => void;
};

type Handler = (options: ConfirmOptions) => void;

let handler: Handler | null = null;

/**
 * 다이얼로그를 실제로 띄울 주체를 등록한다. ConfirmHost 가 마운트될 때 부른다.
 *
 * 돌려주는 함수로 해제하되, 그때까지 다른 호스트가 등록했다면 건드리지 않는다 —
 * 언마운트가 마운트보다 늦게 도는 경우에 새 호스트를 지워버리는 것을 막는다.
 */
export function setConfirmHandler(next: Handler): () => void {
  handler = next;
  return () => {
    if (handler === next) handler = null;
  };
}

export function confirm(options: ConfirmOptions) {
  if (!handler) {
    // ConfirmHost 는 앱 셸(app/_layout.tsx)에 항상 있다. 여기 닿았다면 셸 바깥에서 부른 것이다.
    console.warn(`[confirm] ConfirmHost 가 없어 "${options.title}" 을 띄우지 못했다`);
    return;
  }
  handler(options);
}
