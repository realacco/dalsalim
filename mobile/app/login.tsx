import { useState } from 'react';
import { Keyboard, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';

import { API_BASE, ApiError, api } from '../src/api/client';
import { useSession } from '../src/store/session';
import { colors, font, radius, space } from '../src/theme';
import { Button, Card, ErrorText, Input, Muted } from '../src/components/ui';

type AuthConfig = { kakao: boolean; dev: boolean };

export default function LoginScreen() {
  const router = useRouter();
  const signIn = useSession((state) => state.signIn);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devName, setDevName] = useState('');

  const config = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => api<AuthConfig>('/auth/config'),
    retry: 0,
  });

  async function finish(token: string) {
    await signIn(token);
    const me = useSession.getState().me;
    router.replace(me && me.memberships.length > 0 ? '/(tabs)' : '/onboarding');
  }

  /**
   * 카카오 로그인.
   * 앱은 카카오를 직접 부르지 않는다. 서버가 열어주는 주소를 브라우저로 띄우고,
   * 서버가 되돌려주는 주소에서 토큰만 꺼낸다. (server/src/routes/auth.ts 참조)
   */
  async function loginWithKakao() {
    setError(null);
    setBusy(true);

    try {
      const returnUrl = Linking.createURL('/auth-callback');
      const startUrl = `${API_BASE}/auth/kakao/start?returnUrl=${encodeURIComponent(returnUrl)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);

      if (result.type !== 'success') {
        setBusy(false);
        return; // 사용자가 창을 닫았다 — 조용히 돌아온다
      }

      const { queryParams } = Linking.parse(result.url);
      const token = queryParams?.token;

      if (typeof token !== 'string') {
        throw new Error(String(queryParams?.error ?? '카카오 로그인이 취소됐어요.'));
      }

      await finish(token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : String((caught as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function loginAsDev() {
    Keyboard.dismiss();
    setError(null);

    const name = devName.trim();
    if (!name) {
      setError('이름을 적어주세요.');
      return;
    }

    setBusy(true);
    try {
      const { token } = await api<{ token: string }>('/auth/dev', {
        method: 'POST',
        body: { name },
        token: null,
      });
      await finish(token);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '로그인하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.logo}>달살림</Text>
        <Text style={styles.tagline}>우리 가족,{'\n'}한 달 살림을 같이 적는다</Text>
      </View>

      <View style={styles.actions}>
        <ErrorText>{error}</ErrorText>

        <Button
          label="카카오로 시작하기"
          variant="kakao"
          onPress={loginWithKakao}
          loading={busy}
          disabled={config.data ? !config.data.kakao : false}
        />

        {config.data && !config.data.kakao ? (
          <Muted style={styles.centerText}>
            서버에 카카오 키가 없어요. 아래 개발용 로그인으로 먼저 둘러보세요.
          </Muted>
        ) : null}

        {config.isError ? (
          <Muted style={styles.centerText}>
            서버에 닿지 못했어요.{'\n'}
            {API_BASE} 가 떠 있는지 확인해주세요.
          </Muted>
        ) : null}

        {config.data?.dev ? (
          <Card style={styles.devCard}>
            <Text style={styles.devTitle}>개발용 로그인</Text>
            <Muted>
              이름만 적으면 그 이름의 계정으로 들어갑니다. 같은 이름은 같은 사람입니다.
            </Muted>
            <Input
              value={devName}
              onChangeText={setDevName}
              placeholder="아빠"
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={loginAsDev}
              style={{ marginTop: space.sm }}
            />
            <Button label="들어가기" variant="ghost" onPress={loginAsDev} disabled={busy} />
          </Card>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center', gap: space.md },
  logo: { fontSize: 40, fontWeight: '800', color: colors.ink, letterSpacing: -1.5 },
  tagline: { ...font.title, color: colors.inkSoft },
  actions: { gap: space.md, paddingBottom: space.lg },
  centerText: { textAlign: 'center' },
  devCard: { gap: space.md, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg },
  devTitle: { ...font.body, fontWeight: '700', color: colors.ink },
});
