// 기능: F-FAM-01 F-FAM-03 F-SES-06
import { useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useQueryClient } from '@tanstack/react-query';

import { createFamily, familyKeys, joinFamily } from '@/entities/family';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, ErrorText, Field, Input, Muted } from '@/shared/ui';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from '@/shared/lib/errors';
import { truncateText } from '@/shared/lib/format';

/** 서버 zod 의 displayName `.max(20)` 과 같다 — 입력 칸 한도와 기본값 자르기가 같이 쓴다 */
const DISPLAY_NAME_MAX = 20;

type Mode = 'create' | 'join';

export default function OnboardingScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { me, refreshMe, selectFamily } = useSession();

  const [mode, setMode] = useState<Mode>('create');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  // 카카오 닉네임은 화면에 안 보여주고 이 칸의 처음 값으로만 쓴다 — 가족 안의 이름은 본인이 고친다.
  // 서버가 20자까지 받으므로 긴 닉네임은 잘라서 넣는다 (이모지를 반쪽으로 자르지 않게 truncateText)
  const [displayName, setDisplayName] = useState(() =>
    truncateText(me?.user.nickname ?? '', DISPLAY_NAME_MAX),
  );
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
      // 참여는 "요청"이다. 가족장이 승인해야 구성원이 되므로 곧장 탭으로 보내면 안 된다 —
      // 아직 아무것도 볼 수 없어서 빈 화면이나 권한 오류를 만나게 된다.
      if (mode === 'join') {
        await joinFamily({
          inviteCode: inviteCode.trim().toUpperCase(),
          displayName: displayName.trim(),
        });
        await queryClient.invalidateQueries({ queryKey: familyKeys.myPending() });
        router.replace('/pending');
        return;
      }

      const family = await createFamily({
        name: familyName.trim(),
        displayName: displayName.trim(),
      });

      await refreshMe();
      await selectFamily(family.id);
      router.replace('/(tabs)');
    } catch (caught) {
      setError(errorMessage(caught, MESSAGES.actionFailedBody));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={{ gap: space.sm }}>
        <Text style={styles.title}>우리 가족 만들기</Text>
        <Muted>가족을 새로 만들거나 이미 있는 가족에 들어갈 수 있어요.</Muted>
      </View>

      <View style={styles.tabs}>
        <Tab label="새로 만들기" active={mode === 'create'} onPress={() => setMode('create')} />
        <Tab label="초대코드로 참여" active={mode === 'join'} onPress={() => setMode('join')} />
      </View>

      <Card style={{ gap: space.lg }}>
        {mode === 'create' ? (
          <Field label="가족 이름" hint="예: 김씨네, 우리집">
            <Input
              value={familyName}
              onChangeText={setFamilyName}
              placeholder="김씨네"
              maxLength={20}
            />
          </Field>
        ) : (
          <Field label="초대코드" hint="가족에게 받은 6자리 코드. 가족장이 승인해야 들어가요.">
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

        <Field
          label="내 이름"
          hint="가족 안에서 불리는 이름이에요. 가족이 부르는 이름으로 바꿔주세요."
        >
          <Input
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="아빠"
            maxLength={DISPLAY_NAME_MAX}
          />
        </Field>

        <ErrorText>{error}</ErrorText>

        <Button
          label={mode === 'create' ? '가족 만들기' : '참여 요청하기'}
          onPress={submit}
          loading={busy}
        />
      </Card>

      <View style={{ flex: 1 }} />

      {/*
        가족을 아직 안 만든 사람에게는 여기가 유일한 출구다. 로그아웃을 여기 따로 두는 대신
        내 정보로 보낸다 — 같은 버튼을 세 화면에 복사해 두지 않기 위해서다 (F-SES-06).
      */}
      <Pressable onPress={() => router.push('/me')}>
        <Muted style={{ textAlign: 'center' }}>내 정보 · 로그아웃</Muted>
      </Pressable>
    </SafeAreaView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg, padding: t.space.xl, gap: t.space.xl },
  title: { ...t.font.display, fontWeight: t.weight.heavy, color: t.colors.ink },

  tabs: {
    flexDirection: 'row',
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.md,
    padding: t.space.xs,
    gap: t.space.xs,
  },
  tab: { flex: 1, paddingVertical: t.space.md, borderRadius: t.radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: t.colors.surface },
  tabLabel: { ...t.font.body, color: t.colors.inkFaint, fontWeight: t.weight.semibold },
  tabLabelActive: { color: t.colors.ink },

  codeInput: { ...t.font.codeInput, fontWeight: t.weight.bold, textAlign: 'center' },
}));
