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
  const insets = useSafeAreaInsets();

  // 제스처 바에 깔리지 않게 하단 인셋을 더한다. 인셋이 0으로 오는 기기가 있어 최소값을 둔다.
  const bottom = Math.max(insets.bottom, 10);

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
    borderTopWidth: 1,
    borderTopColor: t.colors.line,
    paddingTop: t.space.sm,
    paddingHorizontal: t.space.sm,
  },
  slot: { flex: 1 },
  item: { alignItems: 'center', justifyContent: 'center', paddingVertical: t.space.xs },
  pillWrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space.md },
  pill: {
    position: 'absolute',
    top: -2,
    left: 0,
    right: 0,
    bottom: -2,
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radius.pill,
  },
  label: {
    ...t.font.small,
    color: t.colors.inkFaint,
    fontWeight: t.weight.semibold,
    paddingVertical: t.space.sm,
  },
  labelActive: { color: t.colors.primary, fontWeight: t.weight.bold },
}));
