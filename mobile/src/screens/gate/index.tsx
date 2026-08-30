import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, space } from '@/shared/config/theme';
import { useSession } from '@/entities/session';
import { Loading } from '@/shared/ui';

/**
 * 앱을 열면 여기로 온다. 토큰과 가족 유무만 보고 갈 곳을 정한다.
 *   토큰 없음  → 로그인
 *   가족 없음  → 가족 만들기/참여
 *   둘 다 있음 → 이번 달
 */
export default function Gate() {
  const { ready, token, me } = useSession();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <Text style={styles.logo}>달살림</Text>
        <Text style={styles.tagline}>우리 가족, 한 달 살림을 같이 적는다</Text>
        <Loading />
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;
  if (!me || me.memberships.length === 0) return <Redirect href="/onboarding" />;

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  logo: { fontSize: 32, fontWeight: '800', color: colors.ink, letterSpacing: -1 },
  tagline: { ...font.small, color: colors.inkFaint, marginBottom: space.xl },
});
