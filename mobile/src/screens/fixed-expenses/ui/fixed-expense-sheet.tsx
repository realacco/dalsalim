import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/shared/model/types';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { AmountInput, Button, Chip, ErrorText, Field, Input, Notice } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

import { type Draft, sanitizeDay } from '../model/draft';
import { DRAG_CANCEL_X, DRAG_START_SLOP, dragOffset, shouldDismiss } from '../model/gesture';

/** 고정비 하나를 추가·수정하는 아래 시트. draft 가 없으면 닫혀 있다. */
export function FixedExpenseSheet({
  draft,
  error,
  saving,
  onChange,
  onSave,
  onRemove,
  onClose,
}: {
  draft: Draft | null;
  error: string | null;
  saving: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { motion, space } = useTheme();
  const insets = useSafeAreaInsets();
  const isOpen = draft !== null;

  /**
   * 시트를 손가락으로 끌어내리기 위한 값.
   *
   * Modal 의 `animationType="slide"` 는 그대로 두고 그 **안쪽**을 옮긴다. 둘은 더해지므로
   * 끌어내리던 위치에서 그대로 이어서 닫힌다 — 놓는 순간 제자리로 튀어올랐다가
   * 다시 내려가는 끊김이 없다.
   *
   * 값을 옮기는 것은 RN 기본 `Animated` 그대로다. 바꾼 것은 **제스처를 받는 쪽**뿐이다 —
   * `PanResponder` 가 `Modal` 안에서 아무 반응이 없었다 (#20).
   */
  const translateY = useRef(new Animated.Value(0)).current;

  /** 제스처는 한 번만 만든다. `onClose` 는 매 렌더 새로 오므로 ref 로 건넨다 */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  /**
   * 끌어내리다 만 위치가 다음에 열 때까지 남아 있으면 안 된다.
   *
   * `useEffect` 가 아니라 layout effect 인 이유: useEffect 는 **그려진 뒤에** 돈다.
   * 끌어내려 닫은 다음 다시 열면 옛 값(예: 130)인 채로 한 번 그려지고 나서 0 이 된다 —
   * 슬라이드가 도는 중이라 잘 안 보이지만, 안 보이는 것과 없는 것은 다르다.
   */
  useLayoutEffect(() => {
    if (isOpen) translateY.setValue(0);
  }, [isOpen, translateY]);

  const settle = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      ...motion.spring,
    }).start();
  }, [translateY, motion.spring]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        /*
          🔴 **이 줄을 지우면 안 된다.** gesture-handler 의 콜백은 기본이 워클릿(UI 스레드)인데,
          아래에서 부르는 `translateY.setValue` 는 RN 기본 `Animated` 의 **JS 전용** API 라
          UI 스레드에서 부르면 터진다. 콜백을 JS 스레드에 붙들어 두는 설정이다.

          값 하나짜리 시트라 Reanimated 로 갈아타 워클릿 배관을 들일 이유도 없다.
        */
        .runOnJS(true)
        // 잡고 포기하는 기준을 라이브러리에 맡긴다 — 직접 재던 것을 걷어냈다
        .activeOffsetY(DRAG_START_SLOP)
        .failOffsetX([-DRAG_CANCEL_X, DRAG_CANCEL_X])
        /*
          복귀 스프링이 도는 중에 다시 잡으면 스프링(네이티브)과 아래의 setValue(JS)가
          같은 값을 서로 쓰면서 손가락을 안 따라오거나 튄다. 잡는 순간 스프링을 멈춘다.
        */
        .onStart(() => translateY.stopAnimation())
        .onUpdate((event) => translateY.setValue(dragOffset(event.translationY)))
        .onEnd((event, success) => {
          /*
            ⚠️ `onEnd` 는 손을 뗐을 때만이 아니라 **잡힌 뒤 뺏겼을 때도** 불린다
            (전화 수신 · 시스템 제스처). 그걸 가르는 것이 `success` 다 —
            안 보면 120dp 끌어둔 채로 뺏겼을 때 놓지도 않은 시트가 닫힌다.
            `PanResponder` 때는 release 와 terminate 로 갈려 있던 구분이다.
          */
          if (!success) return;
          if (shouldDismiss(event.translationY, event.velocityY)) onCloseRef.current();
          else settle();
        })
        // 잡히지 못했거나 뺏긴 경우를 제자리로. 끌린 채 남으면 아래가 벌어진다
        .onFinalize((_event, success) => {
          if (!success) settle();
        }),
    [translateY, settle],
  );

  /**
   * 시스템 내비게이션 영역 **위에** 여유를 얹는다. 탭 바(`widgets/tab-bar`)와 **같은 모양**이되
   * 최소값이 다르다 — 탭 바는 `lg`, 여기는 `xl`. 같은 계산이라고 읽고 한쪽만 고치면 안 된다.
   *
   * 탭 바가 있는 화면은 탭 바 높이가 이 자리를 대신 비워준다. 시트에는 그게 없어서
   * [닫기] 가 제스처 바·3버튼 바에 그대로 깔린다 — 투명해서 가려지진 않지만 겹쳐서 안 읽힌다.
   * 인셋이 0으로 오는 기기가 있어 지금까지 쓰던 xl 을 최소값으로 남긴다.
   */
  const bottom = Math.max(insets.bottom + space.md, space.xl);

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      {/*
        ⚠️ gesture-handler 는 RN `Modal` 안에서 그냥은 안 돈다. Modal 은 별도의 네이티브 창이라
        앱 루트의 제스처 트리 밖에 있어서, **이 안에 뿌리를 한 번 더 심어야** 한다.
      */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/*
          키보드를 피하는 건 시트가 아니라 **화면 전체**여야 한다.
          시트만 감싸면 줄어들 여지가 없어서 [저장] 이 키보드에 그대로 덮인다.
          바깥 컨테이너를 줄여야 아래 정렬된 시트가 키보드 위로 올라온다. (에뮬레이터에서 확인)
        */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/*
              잡는 영역은 알약(40x4)이 아니라 **제목까지 포함한 머리 전체**다.
              4dp 짜리를 정확히 짚으라고 할 수 없다 — 원래 후기도 "서랍 형태" 였다.
              제스처를 여기에만 걸어야 안쪽 목록 스크롤과 안 싸운다.
            */}
            <GestureDetector gesture={drag}>
              <View style={styles.header}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>{draft?.id ? '고정비 수정' : '고정비 추가'}</Text>
              </View>
            </GestureDetector>
            {/*
              패딩은 ScrollView 가 아니라 contentContainerStyle 에 준다.
              시트에 패딩을 주면 ScrollView 가 그만큼 안쪽에 놓여서
              스크롤바가 화면 끝이 아니라 글자 위에 그려진다.
            */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.sheetContent, { paddingBottom: bottom }]}
            >
              {/*
                '생활비' 를 여기 넣는 사람이 있는데, 뜻이 두 가지다. (기획서 3장)
                매달 이체하는 정액이면 고정비가 맞지만, 실제로 쓴 총액이면 매달 금액이 달라서
                위저드가 매번 사유를 묻는다 — 사유가 "예외 기록"이 아니라 "매달 잔업"이 된다.
                등록하기 전에 갈라줘야 한다.
              */}
              <Notice>
                매달 <Text style={styles.noticeStrong}>같은 금액</Text>이 나가는 것만 등록해요.
                생활비도 매달 옮겨두는 정액이면 여기 맞고, 실제로 쓴 돈은 기록할 때 적어요.
              </Notice>

              <Field label="항목 이름" hint="예: 통신비, 월세, 자동차보험">
                <Input
                  value={draft?.name ?? ''}
                  onChangeText={(name) => onChange({ name })}
                  placeholder="통신비"
                  maxLength={30}
                />
              </Field>

              <Field label="분류">
                <View style={styles.chips}>
                  {CATEGORIES.map((category) => (
                    <Chip
                      key={category}
                      label={category}
                      selected={draft?.category === category}
                      onPress={() => onChange({ category })}
                    />
                  ))}
                </View>
              </Field>

              <Field label="기본 금액" hint="매달 기록할 때 이 금액이 먼저 채워져요.">
                <AmountInput
                  size="md"
                  value={draft?.defaultAmount ?? null}
                  onChange={(defaultAmount) => onChange({ defaultAmount })}
                />
              </Field>

              <Field label="결제일 (선택)" hint="1~31 사이 숫자">
                <Input
                  value={draft?.dayOfMonth ?? ''}
                  onChangeText={(text) => onChange({ dayOfMonth: sanitizeDay(text) })}
                  placeholder="25"
                  keyboardType="number-pad"
                />
              </Field>

              <ErrorText>{error}</ErrorText>

              <Button label="저장" onPress={onSave} loading={saving} />

              {draft?.id ? (
                <Button
                  label="이 항목 지우기"
                  variant="ghost"
                  onPress={() =>
                    confirm({
                      title: '고정비 지우기',
                      body: '앞으로의 기록에서 빠져요. 지난 기록은 그대로 남아요.',
                      confirmLabel: '지우기',
                      destructive: true,
                      onConfirm: onRemove,
                    })
                  }
                />
              ) : null}

              <Button label="닫기" variant="ghost" onPress={onClose} />
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  gestureRoot: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    maxHeight: '90%',
    ...t.shadow.sheet,
  },
  /** 알약과 제목을 함께 담는 **잡는 영역**. 이 띠 전체가 손잡이다 */
  header: { paddingTop: t.space.lg, paddingBottom: t.space.md, gap: t.space.md },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
  },
  sheetContent: {
    paddingHorizontal: t.space.xl,
    gap: t.space.lg,
  },
  sheetTitle: {
    ...t.font.title,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    paddingHorizontal: t.space.xl,
  },
  noticeStrong: { fontWeight: t.weight.bold, color: t.colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
}));
