import type { ReactNode } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

import { makeStyles } from '@/shared/config/theme-provider';
import { useSheetDrag } from './use-sheet-drag';

/**
 * 아래에서 올라오는 시트의 **껍데기** — 모달 · 배경 · 끌어내려 닫기 · 손잡이 · 제목.
 * 안에 무엇을 그릴지(스크롤인지, 여백이 얼마인지)는 부르는 쪽이 children 으로 정한다.
 *
 * 처음엔 끌기 배관(`use-sheet-drag`)만 올리고 껍데기는 시트마다 그렸다 — 뚜껑이 달라서
 * 컴포넌트로 묶으면 차이가 전부 프롭이 될 거라 봤다. 네 번째 시트에서 세어 보니 차이는
 * 제목 유무 · 배경을 누르면 닫히나 둘뿐이었고, 복사본끼리는 배경색·머리 여백이 조용히 갈라져 있었다.
 * 갈라진 모양은 먼저 생긴 둘(고정비 · 계산기)로 맞췄다.
 *
 * ⚠️ `Modal` 은 별도의 네이티브 창이라 앱 루트의 제스처 트리 밖에 있다 —
 * 그래서 이 안에 `GestureHandlerRootView` 를 한 번 더 심는다. 빼면 끌기가 안 돈다.
 */
export function Sheet({
  visible,
  onClose,
  title,
  dismissOnBackdrop = false,
  capHeight = true,
  children,
}: {
  visible: boolean;
  /** 끌어내리기 · 뒤로가기 · (켜져 있으면) 배경 누르기가 모두 여기로 온다 */
  onClose: () => void;
  /** 없으면 손잡이만 그린다 (계산기 — 자판이 곧 제목이다) */
  title?: string;
  /**
   * 배경을 누르면 닫나. **입력이 있는 시트는 끈다** — 칸 밖을 잘못 누른 한 번에 적던 것이 날아간다.
   * 고르기만 하는 시트(정산일 · 구성원 관리)는 켠다.
   */
  dismissOnBackdrop?: boolean;
  /**
   * 화면의 90% 로 높이를 묶나. **안쪽이 ScrollView 인 시트만** 켠다 — 묶인 높이를 넘는 만큼 스크롤로 받는다.
   * 스크롤이 없는 시트(계산기)에 묶으면 RN 은 줄이지 않고 넘치게 두어서, 큰 글자 설정에서
   * 맨 아래 [이 금액 쓰기] 가 화면 밖으로 밀린다. 그런 시트는 자기 높이가 곧 뚜껑이다
   */
  capHeight?: boolean;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { translateY, drag } = useSheetDrag(visible, onClose);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/*
          키보드를 피하는 건 시트가 아니라 **화면 전체**여야 한다 (시행착오 1-5).
          시트만 감싸면 줄어들 여지가 없어서 [저장] 이 키보드에 그대로 덮인다.
          바깥을 줄여야 아래 정렬된 시트가 키보드 위로 올라온다. 입력이 없는 시트에는 아무 일도 안 한다.
        */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {dismissOnBackdrop ? (
            <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="닫기" />
          ) : (
            <View style={styles.fill} />
          )}
          <Animated.View
            style={[styles.sheet, capHeight && styles.capped, { transform: [{ translateY }] }]}
          >
            {/*
              잡는 영역은 알약(40x4)이 아니라 **제목까지 포함한 머리 전체**다 — 4dp 짜리를 정확히
              짚으라고 할 수 없다. 제스처를 여기에만 걸어야 안쪽 스크롤과 안 싸운다.
            */}
            <GestureDetector gesture={drag}>
              <View style={[styles.header, title ? styles.headerWithTitle : null]}>
                <View style={styles.grabber} />
                {title ? <Text style={styles.title}>{title}</Text> : null}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  gestureRoot: { flex: 1 },
  // 넘칠 땐 위로 넘쳐야 한다 — 아래로 넘치면 시트 맨 아래 버튼(계산기의 [이 금액 쓰기])이 화면 밖으로 밀린다
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: t.colors.overlay },
  fill: { flex: 1 },
  sheet: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    ...t.shadow.sheet,
  },
  capped: { maxHeight: '90%' },
  /** 알약과 제목을 함께 담는 **잡는 영역**. 이 띠 전체가 손잡이다 */
  header: { paddingTop: t.space.lg, paddingBottom: t.space.md },
  headerWithTitle: { gap: t.space.md },
  grabber: {
    alignSelf: 'center',
    width: t.size.grabberWidth,
    height: t.size.grabberHeight,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
  },
  /**
   * 제목은 스크롤 밖이라 여기서 들여쓴다. 안쪽 여백은 시트마다 contentContainerStyle 에 준다 —
   * 시트에 패딩을 주면 ScrollView 가 그만큼 안쪽에 놓여 스크롤바가 글자 위에 그려진다.
   */
  title: {
    ...t.font.title,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    paddingHorizontal: t.space.xl,
  },
}));
