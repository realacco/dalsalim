import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font } from '../../src/theme';

export default function TabsLayout() {
  // edge-to-edge 라 탭 바가 제스처 바에 깔린다. 하단 인셋을 직접 더해준다.
  // 인셋이 0으로 오는 기기가 있어(에뮬레이터에서 확인) 최소값을 둔다.
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 14);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
        // 아이콘을 두지 않는다. 탭이 셋뿐이고 이름이 짧아 글자만으로 충분하다.
        // (아이콘 폰트를 안 넣은 채로 비워두면 안드로이드에서 두부 글자가 뜬다)
        tabBarIcon: () => null,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 54 + bottom,
          paddingBottom: bottom,
        },
        tabBarItemStyle: { paddingVertical: 8 },
        tabBarLabelStyle: { ...font.body, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '이번 달' }} />
      <Tabs.Screen name="fixed" options={{ title: '고정비' }} />
      <Tabs.Screen name="family" options={{ title: '가족' }} />
    </Tabs>
  );
}
