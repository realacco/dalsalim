// 기능: F-SES-06 F-SES-04
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { BuildInfo, Button, Card, Muted } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

import { useMe } from './model/use-me';

/**
 * 내 정보 — 계정과 이 기기에 관한 것을 한 곳에 모은다.
 *
 * 탭이 아니라 화면인 이유: 한 달에 몇 번 여는 곳에 탭 자리를 주면
 * 매일 쓰는 넷(이번 달 · 고정비 · 추이 · 가족)이 그만큼 좁아진다.
 */
export default function MeScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const m = useMe();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.title}>내 정보</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* 가족 이름은 다른 사람이 바꾼다. 목록이 있는 화면이라 당겨서 새로고침을 단다 */}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={m.refreshing} onRefresh={m.refresh} />}
      >
        <Card style={{ gap: space.sm }}>
          <Text style={styles.cardTitle}>프로필</Text>
          <Text style={styles.nickname}>{m.nickname}</Text>
          <Muted>가족 안에서 불리는 이름은 가족마다 따로 있어요. 가족 탭에서 바꿀 수 있어요.</Muted>
        </Card>

        <Card style={{ gap: space.md }}>
          <Text style={styles.cardTitle}>내 가족</Text>

          {m.families.length === 0 ? (
            <Muted>아직 속한 가족이 없어요.</Muted>
          ) : (
            m.families.map((membership) => (
              <Pressable
                key={membership.id}
                onPress={() => m.switchFamily(membership.family.id)}
                style={[
                  styles.familyRow,
                  membership.family.id === m.familyId && styles.familyRowActive,
                ]}
              >
                <Text style={styles.familyName}>{membership.family.name}</Text>
                <Muted>{membership.displayName}</Muted>
              </Pressable>
            ))
          )}
        </Card>

        <Button
          label="로그아웃"
          variant="ghost"
          onPress={() =>
            confirm({
              title: '로그아웃',
              body: '다시 로그인하면 그대로예요.',
              confirmLabel: '로그아웃',
              destructive: true,
              onConfirm: m.signOut,
            })
          }
        />

        {/* 지금 이 폰이 어느 번들을 보고 있는지. OTA 가 닿았는지 가리는 유일한 창구다 */}
        <BuildInfo />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
  },
  back: { ...t.font.glyph, color: t.colors.inkSoft, width: 24 },
  title: { ...t.font.bodyLg, fontWeight: t.weight.heavy, color: t.colors.ink },

  content: { padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxl },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  nickname: { ...t.font.display, fontWeight: t.weight.heavy, color: t.colors.ink },

  /* 가족 탭의 「가족 바꾸기」 카드에서 그대로 옮겨온 모양이다 */
  familyRow: {
    padding: t.space.md,
    borderRadius: t.radius.md,
    borderWidth: t.border.hairline,
    borderColor: t.colors.line,
    gap: t.space.xxs,
  },
  familyRowActive: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySoft },
  familyName: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },
}));
