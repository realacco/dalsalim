import { Tabs } from 'expo-router';

import { AppTabBar } from '@/widgets/tab-bar';

export default function TabsLayout() {
  return (
    // 기본 탭 바는 글자 색만 바꿔서 지금 어디인지가 약하고 눌러도 반응이 없다.
    // 직접 그린 것으로 갈아끼운다. (widgets/tab-bar)
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: '이번 달' }} />
      <Tabs.Screen name="fixed" options={{ title: '고정비' }} />
      <Tabs.Screen name="trend" options={{ title: '추이' }} />
      <Tabs.Screen name="family" options={{ title: '가족' }} />
    </Tabs>
  );
}
