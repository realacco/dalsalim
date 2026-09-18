import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';

/**
 * 키보드가 올라온 만큼 안쪽을 밀어 올리는 **바깥 껍데기**.
 *
 * 키보드를 피하는 건 화면 전체다 (시행착오 1-5) — 시트나 카드만 감싸면 줄어들 여지가 없어서
 * 아래쪽 버튼이 그대로 덮인다. 그래서 헤더 아래 전체처럼 **가장 바깥**을 이걸로 감싼다.
 *
 * ⚠️ **안드로이드에도 `behavior` 를 준다.** 비워두면 창이 스스로 줄어들기(`adjustResize`)를
 * 기대하는 것인데, edge-to-edge 에서는 창이 안 줄어서 **아무 일도 일어나지 않는다** —
 * 버튼이 키보드 밑에 깔린 채 스크롤로도 닿지 않는다 (가족 탭 #78 · 위저드와 내 정보 #86).
 * `'height'` 는 고정비 시트에서 먼저 확인된 값이라 그대로 따른다.
 *
 * 같은 삼항식이 네 곳에 복사돼 있었고 안드로이드 값이 갈려서(`'height'` 둘 · `undefined` 둘)
 * 화면마다 다르게 동작했다. 재사용 3회 규칙으로 한 곳에 모은다 — **고칠 곳이 여기 하나여야
 * 다음 화면이 또 갈리지 않는다.**
 */
export function KeyboardAvoidingArea({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <KeyboardAvoidingView
      style={[styles.fill, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles(() => ({
  // 줄어들 여지는 이 껍데기가 화면을 다 차지할 때만 생긴다 — 부르는 쪽이 잊어도 되게 기본으로 둔다
  fill: { flex: 1 },
}));
