import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';
import { type ConfirmOptions, setConfirmHandler } from '@/shared/lib/confirm';
import { Button } from './button';

/**
 * 확인 다이얼로그의 생김새.
 *
 * 시스템 Alert 을 쓰지 않는 이유는 하나다 — 앱 안에서 저것만 혼자 튄다.
 * 둥근 정도도 글꼴도 버튼 모양도 우리 것이 아니라서, 되돌리기 어려운 동작 앞이라는
 * 가장 중요한 순간에 화면이 남의 것처럼 보인다. (실사용 후기 2026-09-07)
 *
 * Modal 로 띄우는 것은 취향이 아니라 필요다. RN 의 Modal 은 별도의 네이티브 창이라
 * 다른 Modal(고정비 시트) 위에도 뜬다. 같은 트리 안의 절대 배치 View 로 만들면
 * 시트 아래에 깔려 안 보인다.
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      /* 안 켜면 상태바 아래만 덮여서, 가운데 뜬 다이얼로그 위쪽이 덜 어둡다 */
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      {/* 바깥을 누르면 취소된다. 취소는 아무 일도 안 하는 쪽이라 이렇게 열어둬도 안전하다 */}
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/*
          누름이 배경으로 새어나가지 않게 막는다. 카드 자체를 Pressable 로 두는 것보다
          이쪽이 낫다 — 카드에는 눌리는 느낌이 없어야 한다
        */}
        <Pressable
          style={styles.dialog}
          accessibilityViewIsModal
          accessibilityRole="alert"
          onPress={() => {}}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>

          {/* 취소는 항상 왼쪽 (CLAUDE.md 실패 표현 규약) */}
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="ghost" onPress={onCancel} style={styles.action} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              onPress={onConfirm}
              style={styles.action}
            />
          </View>
        </Pressable>
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
    // 태블릿·가로 화면에서 한 줄이 지나치게 길어지지 않게 잡아둔다
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.card,
    padding: t.space.xl,
    ...t.shadow.sheet,
  },
  title: { ...t.font.title, fontWeight: t.weight.bold, color: t.colors.ink },
  body: { ...t.font.body, color: t.colors.inkSoft, marginTop: t.space.sm },
  actions: { flexDirection: 'row', gap: t.space.md, marginTop: t.space.xl },
  action: { flex: 1 },
}));
