import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

import { useTheme } from '@/shared/config/theme-provider';
import {
  DRAG_CANCEL_X,
  DRAG_START_SLOP,
  dragOffset,
  shouldDismiss,
} from '@/shared/lib/sheet-gesture';

/**
 * 아래 시트를 손가락으로 끌어내려 닫는 **배관**. 세 시트가 같은 것을 복사해 쓰고 있었다 —
 * `fixed-expense-sheet` 가 먼저 겪고, `calculator-sheet` 가 그대로 베끼면서
 * "세 번째 시트가 생기면 이 껍데기를 공용으로 올린다"고 적어둔 자리다 (재사용 3회 규칙).
 *
 * 여기 모인 것은 **눈에 안 보이는 함정들**이라 복사본이 갈라지면 그 자리에서만 조용히 되살아난다.
 * 아래 주석 넷은 전부 실제로 데인 기록이다 (#18 · #20 · #22).
 *
 * 그리는 것은 각 시트가 한다 — 시트마다 뚜껑(키보드 회피 · 배경 누르면 닫기 · 자판)이 달라서
 * 껍데기를 통째로 컴포넌트로 묶으면 그 차이가 전부 프롭이 된다.
 * 여기서 받은 `translateY` 를 `Animated.View` 에, `drag` 를 머리의 `GestureDetector` 에 건다.
 *
 * ⚠️ `Modal` 은 별도의 네이티브 창이라 앱 루트의 제스처 트리 밖에 있다.
 * **시트마다 `Modal` 안에 `GestureHandlerRootView` 를 한 번 더 심어야** 이 제스처가 돈다.
 *
 * @param isOpen 시트가 떠 있나 — 열릴 때마다 위치를 0 으로 되돌린다
 * @param onClose 닫기. 매 렌더 새로 와도 된다 (ref 로 받는다)
 */
export function useSheetDrag(isOpen: boolean, onClose: () => void) {
  const { motion } = useTheme();

  /**
   * 시트를 손가락 따라 옮기는 값.
   *
   * Modal 의 `animationType="slide"` 는 그대로 두고 그 **안쪽**을 옮긴다. 둘은 더해지므로
   * 끌어내리던 위치에서 그대로 이어서 닫힌다 — 놓는 순간 제자리로 튀어올랐다가
   * 다시 내려가는 끊김이 없다.
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

  /**
   * 닫기를 **다음 프레임으로 미룬다.**
   *
   * `onEnd` 안에서 곧바로 닫으면 제스처가 정리를 끝내기 전에 `Modal` 이 통째로 뜯겨 나간다.
   * 그러면 다시 열었을 때 한동안 터치가 안 먹는다 — 눌린 것처럼 보이는데
   * (`PressableScale` 의 눌림 효과는 `onPressIn` 이라 뜬다) **`onPress` 가 안 불려서
   * 실제로는 아무것도 안 골라진다.** 스크롤을 한 번 하면 그제야 풀린다.
   *
   * 버튼으로 닫을 때는 이 증상이 없다 — 진행 중인 제스처가 없기 때문이다. 그 차이가 근거다.
   */
  const dismiss = useCallback(() => {
    requestAnimationFrame(() => onCloseRef.current());
  }, []);

  const settle = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      /*
        🔴 **네이티브 드라이버를 일부러 안 쓴다.** 켜면 이 값이 네이티브로 넘어가고,
        그 뒤 JS 의 `setValue`·`stopAnimation` 은 다리를 건너는 비동기 요청이 된다.
        그 갈림에 두 번 데였다 —
        ① 끌어 닫은 뒤 다시 열면 위 layout effect 의 `setValue(0)` 가 화면까지 안 닿아
           **시트가 내려간 채로 열렸다** (#22)
        ② `stopAnimation` 의 콜백이 늦게 와서 "스프링 도중 다시 잡기" 를 못 고쳤다 (#18 6차 리뷰)

        transform 하나짜리 시트라 JS 스레드로 충분하다. 예측 가능한 쪽을 택한다.
      */
      useNativeDriver: false,
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
          복귀 스프링이 도는 중에 다시 잡으면 **도는 애니메이션과 아래의 `setValue` 가
          같은 값을 두고 싸워서** 손가락을 안 따라오거나 튄다. 잡는 순간 스프링을 멈춘다.
          (스레드가 갈려서가 아니다 — 위에서 드라이버를 껐으니 둘 다 JS 쪽이다)
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
          if (shouldDismiss(event.translationY, event.velocityY)) dismiss();
          else settle();
        })
        // 잡히지 못했거나 뺏긴 경우를 제자리로. 끌린 채 남으면 아래가 벌어진다
        .onFinalize((_event, success) => {
          if (!success) settle();
        }),
    [translateY, settle, dismiss],
  );

  return { translateY, drag };
}
