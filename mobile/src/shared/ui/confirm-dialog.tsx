import { useEffect, useState } from 'react';
import { Modal, PixelRatio, Pressable, Text, View } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';
import { type ConfirmOptions, setConfirmHandler } from '@/shared/lib/confirm';
import { Button } from './button';

/**
 * 글자를 이만큼 넘게 키우면 버튼을 세로로 쌓는다.
 *
 * 폭 360dp 기준으로 가로 두 칸일 때 글자가 쓸 수 있는 폭은 약 106px 이다.
 * `그대로 두기` 는 font.bodyLg(17) 굵게로 이미 90px 이라, 안드로이드 "크게"(≈1.15배)에서
 * 두 줄로 감기고 Button 의 고정 높이(54)를 넘어 잘린다.
 * 시스템 Alert 이 알아서 쌓아주던 자리라, 앱 안 모양으로 바꾸면서 직접 해줘야 한다.
 */
const STACK_ABOVE_FONT_SCALE = 1.15;

/**
 * 확인 다이얼로그의 생김새.
 *
 * 시스템 Alert 을 쓰지 않는 이유는 하나다 — 앱 안에서 저것만 혼자 튄다.
 * 둥근 정도도 글꼴도 버튼 모양도 우리 것이 아니라서, 되돌리기 어려운 동작 앞이라는
 * 가장 중요한 순간에 화면이 남의 것처럼 보인다. (실사용 후기 2026-09-07)
 *
 * Modal 로 띄우는 것은 취향이 아니라 필요다. RN 의 Modal 은 별도의 네이티브 창이라
 * 다른 Modal(고정비 시트) 위에도 뜬다. 같은 트리 안의 절대 배치 View 로 만들면
 * 시트 아래에 깔려 안 보인다. (안드로이드 기준 — iOS 는 3층에서 따로 봐야 한다)
 */
function ConfirmDialog({
  options,
  visible,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = useStyles();
  const { title, body, confirmLabel, cancelLabel = '취소', destructive } = options;
  const stacked = PixelRatio.getFontScale() > STACK_ABOVE_FONT_SCALE;

  // 세로로 쌓을 때 flex 를 그대로 두면 높이를 나눠 가지려다 버튼이 납작해진다
  const actionStyle = stacked ? styles.actionStacked : styles.action;

  const cancelButton = (
    <Button label={cancelLabel} variant="ghost" onPress={onCancel} style={actionStyle} />
  );
  const confirmButton = (
    <Button
      label={confirmLabel}
      variant={destructive ? 'danger' : 'primary'}
      onPress={onConfirm}
      style={actionStyle}
    />
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      /* 안 켜면 상태바 아래만 덮여서, 가운데 뜬 다이얼로그 위쪽이 덜 어둡다 */
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/*
        바깥을 누르면 취소된다. 취소는 아무 일도 안 하는 쪽이라 이렇게 열어둬도 안전하다.
        accessible={false} 가 중요하다 — Pressable 의 기본값 true 로 두면 이 막이
        접근성 노드 하나가 되어 안쪽 제목·본문·버튼을 통째로 삼킨다.
      */}
      <Pressable style={styles.backdrop} accessible={false} onPress={onCancel}>
        {/*
          누름이 배경으로 새어나가지 않게 막는다. Pressable 이 아니라 responder 로 막는 이유도
          접근성이다. 카드가 접근성 노드가 되면 iOS 에서 [취소]/[내보내기] 에 따로 포커스가 안 간다.
        */}
        <View style={styles.dialog} accessibilityViewIsModal onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {/*
            취소는 항상 왼쪽 (CLAUDE.md 실패 표현 규약).
            세로로 쌓을 때는 "왼쪽"이 없으므로 아래로 내린다 — 실행이 위, 취소가 아래다.
          */}
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {stacked ? (
              <>
                {confirmButton}
                {cancelButton}
              </>
            ) : (
              <>
                {cancelButton}
                {confirmButton}
              </>
            )}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

/**
 * confirm() 이 부르면 다이얼로그를 띄우는 주체. 앱 셸에 하나만 둔다.
 *
 * 화면 9곳이 `confirm({...})` 을 이벤트 핸들러 안에서 부르고 있어서, 훅으로 바꾸면
 * 그 9곳을 전부 고쳐야 한다. 부르는 쪽 모양을 그대로 두려고 여기서 등록해 받는다.
 */
export function ConfirmHost() {
  // 닫히는 동안에도 내용이 남아 있어야 한다. visible 만 내리면 사라지면서 빈 카드가 페이드된다
  const [state, setState] = useState<{ options: ConfirmOptions; visible: boolean } | null>(null);

  useEffect(() => setConfirmHandler((options) => setState({ options, visible: true })), []);

  if (!state) return null;

  const close = () => setState((prev) => (prev ? { ...prev, visible: false } : null));

  return (
    <ConfirmDialog
      options={state.options}
      visible={state.visible}
      onCancel={close}
      onConfirm={() => {
        /*
          페이드가 끝날 때까지 카드가 살아 있어서 한 번 더 눌린다.
          시스템 Alert 은 눌리는 즉시 사라져 없던 문제인데, 내보내기·거절이 두 번 날아가면 곤란하다.
        */
        if (!state.visible) return;
        close();
        state.options.onConfirm();
      }}
    />
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: {
    flex: 1,
    backgroundColor: t.colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: t.space.screen,
  },
  dialog: {
    /*
      팔레트 값이 아니라 이 컴포넌트의 치수다 (button.tsx 의 height: 54 와 같은 종류).
      태블릿·가로 화면에서 한 줄이 지나치게 길어지지 않게 잡아둔다.
    */
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    // xl 로 두면 폭 360dp 에서 버튼 글자가 쓸 폭이 98px 까지 좁아진다
    padding: t.space.lg,
    ...t.shadow.sheet,
  },
  title: { ...t.font.title, fontWeight: t.weight.bold, color: t.colors.ink },
  body: { ...t.font.body, color: t.colors.inkSoft, marginTop: t.space.sm },
  actions: { flexDirection: 'row', gap: t.space.md, marginTop: t.space.xl },
  actionsStacked: { flexDirection: 'column' },
  action: { flex: 1 },
  actionStacked: { alignSelf: 'stretch' },
}));
