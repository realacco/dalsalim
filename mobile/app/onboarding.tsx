import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api } from '../src/api/client';
import { useSession } from '../src/store/session';
import { colors, font, radius, space } from '../src/theme';
import { Button, Card, ErrorText, Field, Input, Muted } from '../src/components/ui';

type Mode = 'create' | 'join';

export default function OnboardingScreen() {
  const router = useRouter();
  const { me, refreshMe, selectFamily, signOut } = useSession();

  const [mode, setMode] = useState<Mode>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    Keyboard.dismiss();
    setError(null);

    if (!displayName.trim()) {
      setError('가족 안에서 불릴 이름을 적어주세요.');
      return;
    }
    if (mode === 'create' && !familyName.trim()) {
      setError('가족 이름을 적어주세요.');
      return;
    }
    if (mode === 'join' && inviteCode.trim().length !== 6) {
      setError('초대코드는 6자리예요.');
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'create'
          ? await api<{ family: { id: string } }>('/families', {
              method: 'POST',
              body: { name: familyName.trim(), displayName: displayName.trim() },
            })
          : await api<{ family: { id: string } }>('/families/join', {
              method: 'POST',
              body: { inviteCode: inviteCode.trim().toUpperCase(), displayName: displayName.trim() },
            });

      await refreshMe();
      await selectFamily(result.family.id);
      router.replace('/(tabs)');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : '문제가 생겼어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ gap: space.sm }}>
        <Text style={styles.title}>우리 가족 만들기</Text>
        <Muted>
          {me?.user.nickname ? `${me.user.nickname}님, ` : ''}
          가족을 새로 만들거나 이미 있는 가족에 들어갈 수 있어요.
        </Muted>
      </View>

      <View style={styles.tabs}>
        <Tab label="새로 만들기" active={mode === 'create'} onPress={() => setMode('create')} />
        <Tab label="초대코드로 참여" active={mode === 'join'} onPress={() => setMode('join')} />
      </View>

      <Card style={{ gap: space.lg }}>
        {mode === 'create' ? (
          <Field label="가족 이름" hint="예: 김씨네, 우리집">
            <Input value={familyName} onChangeText={setFamilyName} placeholder="김씨네" maxLength={20} />
          </Field>
        ) : (
          <Field label="초대코드" hint="가족에게 받은 6자리 코드">
            <Input
              value={inviteCode}
              onChangeText={(text) => setInviteCode(text.toUpperCase())}
              placeholder="K7QM3D"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={styles.codeInput}
            />
          </Field>
        )}

        <Field label="내 이름" hint="가족 안에서 불리는 이름이에요. 카카오 닉네임과 달라도 괜찮아요.">
          <Input value={displayName} onChangeText={setDisplayName} placeholder="아빠" maxLength={20} />
        </Field>

        <ErrorText>{error}</ErrorText>

        <Button
          label={mode === 'create' ? '가족 만들기' : '참여하기'}
          onPress={submit}
          loading={busy}
        />
      </Card>

      <View style={{ flex: 1 }} />

      <Pressable onPress={() => signOut().then(() => router.replace('/login'))}>
        <Muted style={{ textAlign: 'center' }}>다른 계정으로 로그인</Muted>
      </Pressable>
    </SafeAreaView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.xl, gap: space.xl },
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: space.xs,
    gap: space.xs,
  },
  tab: { flex: 1, paddingVertical: space.md, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabLabel: { ...font.body, color: colors.inkFaint, fontWeight: '600' },
  tabLabelActive: { color: colors.ink },

  codeInput: { letterSpacing: 6, fontWeight: '700', textAlign: 'center' },
});
