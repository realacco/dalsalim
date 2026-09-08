import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/shared/model/types';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { AmountInput, Button, Chip, ErrorText, Field, Input, Notice } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

import { type Draft, sanitizeDay } from '../model/draft';

/**
 * 이만큼 끌어내리거나(dp) 이보다 빠르게 튕기면 닫는다. **둘 중 하나만** 넘으면 된다 —
 * 거리로만 재면 짧고 빠르게 튕기는 손짓이 안 먹고, 속도로만 재면 천천히 끝까지
 * 끌어내려도 안 닫힌다.
 *
 * 디자인 값이 아니라 제스처 임계값이라 토큰으로 올리지 않고 여기 둔다.
 */
const DISMISS_DISTANCE = 96;
const DISMISS_VELOCITY = 0.7;

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
   * 제스처 시트 라이브러리를 안 쓴 이유: RN 기본 `Animated` + `PanResponder` 로 되는 일이고,
   * 새 패키지는 네이티브 모듈을 달고 올 위험이 있다. Expo Go 로 바로 도는 개발 루프를
   * 이 정도 UX 와 바꾸지 않는다.
   */
  const translateY = useRef(new Animated.Value(0)).current;

  /** PanResponder 는 한 번만 만든다. `onClose` 는 매 렌더 새로 오므로 ref 로 건넨다 */
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

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 세로로 확실히 움직일 때만 가로챈다 — 분류 칩을 가로로 훑는 손짓을 뺏지 않는다
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          // 위로는 안 따라간다. 시트가 위로 뜨면 아래에 배경이 비친다
          if (gesture.dy > 0) translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          /*
            속도 쪽에도 **방향**을 붙인다. 거리 쪽은 `dy > DISMISS_DISTANCE` 라 저절로
            아래 방향이지만, 속도만 보면 위로 끌어올린 손짓에도 걸린다 —
            아래로 살짝 눌러 잡고(dy=5) 위로 올렸다가(dy=-50) 아래로 튕기며 떼면
            dy 는 음수라 시트는 제자리인데 vy 만 보고 닫힌다. 안 움직인 시트가 사라진다.
          */
          const flungDown = gesture.dy > 0 && gesture.vy > DISMISS_VELOCITY;
          if (gesture.dy > DISMISS_DISTANCE || flungDown) onCloseRef.current();
          else settle();
        },
        // 전화가 오는 등으로 제스처를 뺏기면 제자리로. 끌린 채 남으면 아래가 벌어진다
        onPanResponderTerminate: settle,
      }),
    [translateY, settle],
  );

  /**
   * 시스템 내비게이션 영역 **위에** 여유를 얹는다. 탭 바(`widgets/tab-bar`)와 같은 계산이다.
   *
   * 탭 바가 있는 화면은 탭 바 높이가 이 자리를 대신 비워준다. 시트에는 그게 없어서
   * [닫기] 가 제스처 바·3버튼 바에 그대로 깔린다 — 투명해서 가려지진 않지만 겹쳐서 안 읽힌다.
   * 인셋이 0으로 오는 기기가 있어 지금까지 쓰던 xl 을 최소값으로 남긴다.
   */
  const bottom = Math.max(insets.bottom + space.md, space.xl);

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
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
            손잡이가 이제 진짜 손잡이다. 잡는 영역은 알약(40x4)이 아니라 이 View 전체다 —
            4dp 짜리를 정확히 짚으라고 할 수는 없다.
            제스처를 여기에만 걸어야 안쪽 목록 스크롤과 안 싸운다.
          */}
          <View style={styles.grabArea} {...pan.panHandlers}>
            <View style={styles.grabber} />
          </View>
          {/*
            패딩은 ScrollView 가 아니라 contentContainerStyle 에 준다.
            시트에 패딩을 주면 ScrollView 가 그만큼 안쪽에 놓여서
            스크롤바가 화면 끝이 아니라 글자 위에 그려진다.
          */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.sheetContent, { paddingBottom: bottom }]}
          >
            <Text style={styles.sheetTitle}>{draft?.id ? '고정비 수정' : '고정비 추가'}</Text>

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
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    maxHeight: '90%',
    ...t.shadow.sheet,
  },
  /** 알약을 감싸는 **잡는 영역**. 위아래 여백이 곧 손가락이 닿는 넓이다 */
  grabArea: { alignItems: 'center', paddingVertical: t.space.lg },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
  },
  sheetContent: {
    paddingHorizontal: t.space.xl,
    gap: t.space.lg,
  },
  sheetTitle: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink },
  noticeStrong: { fontWeight: t.weight.bold, color: t.colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
}));
