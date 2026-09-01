import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { PressableScale } from '@/shared/ui';

/**
 * expo-router 가 tabBar 에 넘겨주는 것 중 우리가 쓰는 것만 적는다.
 * @react-navigation/bottom-tabs 는 직접 의존이 아니라서 타입만 가져오려고 의존성을 늘리지 않는다.
 */
type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
};

/**
 * 하단 탭 바.
 *
 * 기본 탭 바는 글자 색만 바꿔서 지금 어디인지가 약하고, 눌러도 아무 반응이 없다.
 * 아이콘 폰트를 안 쓰기로 했으므로(두부 글자 문제) 대신 **선택된 탭에 알약을 깐다.**
 * 색 하나에 기대지 않고 면으로 보여주면 흘깃 봐도 위치를 안다.
 */
export function AppTabBar({ state, descriptors, navigation }: TabBarProps) {
  const styles = useStyles();
  const t = useTheme();
  const insets = useSafeAreaInsets();

  /**
   * 시스템 내비게이션 영역 **위에** 여유를 더 얹는다.
   *
   * insets.bottom 을 패딩으로만 쓰면 그 값을 시스템 버튼이 통째로 먹어서
   * 탭 라벨이 버튼에 딱 붙는다. 3버튼 기기(inset 48dp)에서 5dp 도 안 떨어져 있었다 —
   * 탭을 누르려다 뒤로가기를 누르기 딱 좋다.
   *
   * 인셋이 0으로 오는 기기가 있어 전체에 최소값도 둔다.
   */
  const bottom = Math.max(insets.bottom + t.space.md, t.space.lg);

  return (
    <View style={[styles.bar, { paddingBottom: bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;

        return (
          <TabItem
            key={route.key}
            label={label}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  label,
  focused,
  onPress,
}: {
  label: string;
  focused: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { motion } = useTheme();
  const fade = useRef(new Animated.Value(focused ? 1 : 0)).current;

  // 알약이 뚝 나타나지 않고 흘러나오게 한다
  useEffect(() => {
    Animated.timing(fade, {
      toValue: focused ? 1 : 0,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [focused, fade, motion.base]);

  return (
    <PressableScale
      small
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      containerStyle={styles.slot}
      style={styles.item}
    >
      <View style={styles.pillWrap}>
        <Animated.View style={[styles.pill, { opacity: fade }]} />
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  bar: {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    // 위 카드와 같은 색이라 경계가 흐리면 툴바가 떠 있는 느낌이 안 난다.
    // 실기기(갤럭시 다크)에서 특히 안 보였다.
    borderTopWidth: 1,
    borderTopColor: t.colors.lineStrong,
    paddingTop: t.space.md,
    // 첫/마지막 탭이 화면 가장자리에 붙지 않게
    paddingHorizontal: t.space.md,
  },
  slot: { flex: 1 },
  item: { alignItems: 'center', justifyContent: 'center' },
  pillWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    // 알약이 글자를 감싸는 여백. 너무 크면 탭 표시가 아니라 버튼처럼 읽힌다.
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.sm - 1,
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radius.pill,
  },
  label: {
    ...t.font.small,
    // inkFaint 는 실기기에서 너무 흐렸다. 활성 탭은 색·알약·굵기로 이미 구분되므로
    // 비활성도 읽히는 밝기까지 올린다.
    color: t.colors.inkSoft,
    fontWeight: t.weight.semibold,
  },
  labelActive: { color: t.colors.primary, fontWeight: t.weight.bold },
}));
