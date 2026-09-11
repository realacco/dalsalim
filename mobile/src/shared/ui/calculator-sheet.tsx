// 기능: F-ENT-09
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Modal, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import {
  type CalcState,
  type Notice,
  confirmedExpression,
  formatExpression,
  hasOperation,
  initialState,
  isNegative,
  isSettled,
  notice,
  pressKey,
  result,
} from '@/shared/lib/calc';
import { formatWon } from '@/shared/lib/format';
import {
  DRAG_CANCEL_X,
  DRAG_START_SLOP,
  dragOffset,
  shouldDismiss,
} from '@/shared/lib/sheet-gesture';
import { Button } from './button';
import { PressableScale } from './pressable-scale';

/**
 * 금액 계산기.
 *
 * ★ 자판까지 우리가 그린다. 이 안에는 TextInput 이 없다 — 숫자도 연산자도 버튼이고,
 * 누르면 shared/lib/calc 가 다음 상태를 돌려준다.
 *
 * 그래서 시스템 키보드를 안 띄우고, 커서라는 개념 자체가 없다. 이 프로젝트는 컨트롤드
 * 입력에서 두 번 데였다 — 3자리 콤마로 800000 이 8,000,000 이 된 것(시행착오 1-1),
 * selectTextOnFocus 로 첫 글자가 덮인 것(실사용 후기 8번). 여기서는 둘 다 성립하지 않는다.
 *
 * 시트를 다루는 함정(모달 안 제스처 뿌리 · 다음 프레임 닫기 · 드라이버 끄기)은
 * screens/fixed-expenses/ui/fixed-expense-sheet 가 먼저 겪었다. 주석의 근거는 거기 있다.
 * 세 번째 시트가 생기면 이 껍데기를 공용으로 올린다 (재사용 3회 규칙).
 */
export function CalculatorSheet({
  visible,
  initial,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  /** 열 때 칸에 있던 금액. 첫 숫자로 실려 온다 — 지우고 시작할 필요가 없다 */
  initial: number | null;
  onCancel: () => void;
  /** 수식도 같이 준다 — 칸 아래에 "무엇을 해서 이 금액이 됐는지" 를 남기기 위해 */
  onConfirm: (value: number, expression: string) => void;
}) {
  const styles = useStyles();
  const { motion, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<CalcState>(() => initialState(initial));

  const translateY = useRef(new Animated.Value(0)).current;
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  // 열리는 순간에만 그때의 금액에서 새로 시작한다. 지난번에 계산하다 만 것이 남으면 안 된다.
  // `initial` 을 의존성으로 걸지 않는다 — 떠 있는 동안 부모의 값이 바뀌면 치던 수식이 통째로
  // 날아간다. 지금 호출처 셋은 그러지 않지만 shared/ui 라 다음 화면은 이 조건을 모르고 들어온다.
  // 렌더 중에 맞추는 것은 React 가 "프롭이 바뀌면 상태를 조정한다"에 두는 공식 패턴이다 —
  // 이펙트로 하면 한 프레임은 지난번 상태가 그려진다.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setState(initialState(initial));
  }

  // 떠 있던 시스템 키보드도 내린다 — 자판이 둘 겹치면 시트가 가려진다
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  // 끌어내리다 만 위치가 다음에 열 때까지 남으면 안 된다. 그려지기 전에 되돌린다
  useLayoutEffect(() => {
    if (visible) translateY.setValue(0);
  }, [visible, translateY]);

  const dismiss = useCallback(() => {
    // 제스처가 정리를 끝내기 전에 Modal 을 뜯으면 다음에 열었을 때 터치가 한동안 안 먹는다
    requestAnimationFrame(() => onCancelRef.current());
  }, []);

  const settle = useCallback(() => {
    Animated.spring(translateY, {
      // 네이티브 드라이버를 일부러 안 쓴다. 켜면 위 setValue 가 다리를 건너는 비동기 요청이 되고,
      // 끌어 닫은 뒤 다시 열 때 시트가 내려간 채로 열린다 (#22)
      useNativeDriver: false,
      toValue: 0,
      ...motion.spring,
    }).start();
  }, [translateY, motion.spring]);

  const drag = useMemo(
    () =>
      Gesture.Pan()
        // gesture-handler 콜백은 기본이 워클릿이라, JS 전용인 Animated.setValue 를 부르면 터진다
        .runOnJS(true)
        .activeOffsetY(DRAG_START_SLOP)
        .failOffsetX([-DRAG_CANCEL_X, DRAG_CANCEL_X])
        .onStart(() => translateY.stopAnimation())
        .onUpdate((event) => translateY.setValue(dragOffset(event.translationY)))
        .onEnd((event, success) => {
          // 잡힌 뒤 뺏겼을 때도 onEnd 가 온다. 안 가르면 놓지도 않은 시트가 닫힌다
          if (!success) return;
          if (shouldDismiss(event.translationY, event.velocityY)) dismiss();
          else settle();
        })
        .onFinalize((_event, success) => {
          if (!success) settle();
        }),
    [translateY, settle, dismiss],
  );

  const value = result(state);
  const expression = formatExpression(state);
  /**
   * 치는 동안에는 **수식이 주인공**이고, `=` 를 눌러야 결과가 주인공이 된다.
   * 사람이 아는 계산기가 그 순서라, 반대로 두면 지금 무엇을 치고 있는지가 안 보인다.
   */
  const settled = isSettled(state);
  /** 거드는 줄을 그리나 — 숫자 하나뿐이면 결과를 두 번 적는 셈이라 한 줄로 끝낸다 */
  const showsResult = hasOperation(state);
  /** 한 번에 하나만 — 둘을 그리면 시트가 한 줄만큼 커져 자판이 손 밑에서 움직인다 (calc.notice) */
  const shown = notice(state);
  const negative = isNegative(state);
  // 시스템 내비게이션 위에 딱 붙는다. 시트 바닥이 그보다 더 떠 있으면 버튼이 허공에 뜬 것처럼 보인다
  const bottom = Math.max(insets.bottom, space.md);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      {/* Modal 은 별도의 네이티브 창이라 제스처 뿌리를 이 안에 한 번 더 심어야 돈다 */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.backdrop}>
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <GestureDetector gesture={drag}>
              <View style={styles.header}>
                <View style={styles.grabber} />
              </View>
            </GestureDetector>

            <View style={[styles.body, { paddingBottom: bottom }]}>
              {/*
                수식과 결과는 늘 같이 보인다. 무엇을 눌러 이 금액이 됐는지 안 보이면
                틀렸을 때 사람이 못 찾는다.
              */}
              <View
                accessible
                style={styles.display}
                // 숫자 하나뿐이면 "결과" 가 아니다 — 열자마자 " 결과 0원" 으로 읽히면 안 된다
                accessibilityLabel={
                  showsResult ? `${expression} 결과 ${formatWon(value ?? 0)}` : expression || '0'
                }
              >
                {settled ? (
                  <>
                    {showsResult ? (
                      <Text style={styles.sub} numberOfLines={2}>
                        {expression}
                      </Text>
                    ) : null}
                    <Text style={styles.main}>{formatWon(value ?? 0)}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.main} numberOfLines={2}>
                      {expression || '0'}
                    </Text>
                    {showsResult ? <Text style={styles.sub}>= {formatWon(value ?? 0)}</Text> : null}
                  </>
                )}
                {shown ? (
                  <Text style={shown === 'negative' ? styles.negative : styles.hint}>
                    {NOTICES[shown]}
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: space.sm }}>
                {KEYPAD.map((row) => (
                  <View key={row.join()} style={styles.row}>
                    {row.map((key) => (
                      <PressableScale
                        key={key}
                        accessibilityRole="button"
                        accessibilityLabel={KEY_LABELS[key] ?? key}
                        onPress={() => setState((prev) => pressKey(prev, key))}
                        containerStyle={styles.keySlot}
                        style={[styles.key, TINTED.includes(key) && styles.keyTinted]}
                      >
                        <Text
                          style={[styles.keyLabel, TINTED.includes(key) && styles.keyLabelTint]}
                        >
                          {key}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                ))}
              </View>

              <View style={styles.actions}>
                <Button label="취소" variant="ghost" onPress={onCancel} style={styles.action} />
                <Button
                  label="이 금액 쓰기"
                  disabled={value === null || negative}
                  // 남기는 수식은 친 것이 아니라 계산된 것이다 — 칸의 금액과 갈라지면 안 된다
                  onPress={() => onConfirm(value ?? 0, confirmedExpression(state))}
                  style={styles.confirm}
                />
              </View>
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** 마지막 줄의 0 과 00 은 두 칸씩 차지한다 — 빈 자리를 두면 아래가 뚫려 보인다 */
const KEYPAD = [
  ['C', '←', '÷', '×'],
  ['7', '8', '9', '-'],
  ['4', '5', '6', '+'],
  ['1', '2', '3', '='],
  ['0', '00'],
];

/** 안내 문장. 어느 것을 띄울지는 calc.notice 가 정한다 — 여기는 문장만 안다 */
const NOTICES: Record<Notice, string> = {
  negative: '금액은 0원보다 작을 수 없어요.',
  capped: '금액은 10억까지만 적을 수 있어요.',
  dividesByZero: '0으로는 나눌 수 없어서 그 자리는 건너뛰었어요.',
  rounded: '1원 아래는 반올림했어요.',
};

/** 숫자가 아닌 키는 눈으로 갈린다 */
const TINTED = ['C', '←', '÷', '×', '-', '+', '='];

/** 글리프를 그대로 읽으면 무슨 소린지 모른다. 사람이 부르는 이름으로 읽어준다 */
const KEY_LABELS: Record<string, string> = {
  C: '전부 지우기',
  '←': '한 글자 지우기',
  '÷': '나누기',
  '×': '곱하기',
  '-': '빼기',
  '+': '더하기',
  '=': '계산하기',
  '00': '영 영',
};

const useStyles = makeStyles((t) => ({
  gestureRoot: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    ...t.shadow.sheet,
  },
  header: { paddingTop: t.space.lg, paddingBottom: t.space.md },
  grabber: {
    alignSelf: 'center',
    width: t.size.grabberWidth,
    height: t.size.grabberHeight,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
  },
  body: { paddingHorizontal: t.space.lg, gap: t.space.lg },

  /*
    수식 한 줄 + 결과 한 줄 + 안내 한 줄 자리를 미리 잡아둔다.
    안내는 있다 없다 하는데, 그때마다 시트 높이가 출렁이면 자판이 손 밑에서 움직인다.
    그래서 안내는 언제나 한 줄이다 — 여럿이 걸려도 하나만 고르는 것은 calc.notice 의 몫이다.
  */
  display: {
    gap: t.space.xxs,
    paddingHorizontal: t.space.sm,
    minHeight: t.font.amountLg.lineHeight + t.font.small.lineHeight + t.font.hint.lineHeight,
  },
  /** 주인공 — 치는 동안엔 수식, `=` 뒤엔 결과가 여기 온다 */
  main: {
    ...t.font.amountLg,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    textAlign: 'right',
  },
  /** 거들 — 주인공의 반대쪽이 여기 온다 */
  sub: { ...t.font.small, color: t.colors.inkFaint, textAlign: 'right' },
  hint: { ...t.font.hint, color: t.colors.inkFaint, textAlign: 'right' },
  negative: { ...t.font.hint, color: t.colors.danger, textAlign: 'right' },

  row: { flexDirection: 'row', gap: t.space.sm },
  /* 취소와 확정은 한 줄에 둔다. 취소가 왼쪽 — 확인 다이얼로그와 같은 자리다 */
  actions: { flexDirection: 'row', gap: t.space.sm },
  action: { flex: 1 },
  confirm: { flex: 2 },
  keySlot: { flex: 1 },
  key: {
    minHeight: t.space.xxl + t.space.lg,
    paddingVertical: t.space.md,
    borderRadius: t.radius.md,
    backgroundColor: t.colors.surface,
    borderWidth: t.border.hairline,
    borderColor: t.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyTinted: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primarySoft },
  keyLabel: { ...t.font.title, fontWeight: t.weight.bold, color: t.colors.ink },
  keyLabelTint: { color: t.colors.primary },
}));
