import { Alert } from 'react-native';

type ConfirmOptions = {
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

/**
 * 확인 다이얼로그 — 되돌리기 어려운 동작 앞에 세우는 유일한 방법이다.
 *
 * 규칙 (CLAUDE.md 실패 표현 규약)
 *  - 취소 버튼이 항상 있고, 항상 왼쪽이다
 *  - 실행 버튼은 제목의 동사를 그대로 쓴다. "확인" · "예" 는 쓰지 않는다 — 무엇을 확인하는지 안 보인다
 *  - 되돌리기 어려우면 destructive
 */
export function confirm({
  title,
  body,
  confirmLabel,
  destructive = false,
  cancelLabel = '취소',
  onConfirm,
}: ConfirmOptions) {
  Alert.alert(title, body, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
