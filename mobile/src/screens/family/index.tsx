// 기능: F-FAM-02 F-FAM-06 F-FAM-07 F-FAM-08 F-FAM-09 F-FAM-10 F-FAM-11 F-SES-06
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Loading, Muted, PressableScale, QueryError } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

import { useFamily } from './model/use-family';
import { JoinRequestsCard } from './ui/join-requests-card';
import { MemberActionsSheet } from './ui/member-actions-sheet';
import { MembersCard } from './ui/members-card';
import { SettlementCard } from './ui/settlement-card';
import { SettlementSheet } from './ui/settlement-sheet';

/**
 * 가족 화면 — 초대코드 · 참여 요청 · 구성원. 계정 쪽 일은 내 정보로 옮겼다 (F-SES-06).
 * 상태와 서버 통신은 useFamily 에, 카드 둘은 ui/ 에 있다. 여기는 배치만 한다.
 */
export default function FamilyScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const router = useRouter();
  const f = useFamily();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/*
        키보드를 피하는 건 화면 전체다 (시행착오 1-5) — 구성원 카드의 이름 입력 칸(F-FAM-07)이
        화면 아래쪽에 있어 카드만 감싸면 [저장] 이 키보드에 덮인다. 내 정보 화면과 같은 모양이다
      */}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/*
        당겨서 새로고침이 필요하다. 가족이 방금 초대코드로 참여했는지 확인하는 건
        이 앱에서 가장 자주 하는 동작인데, 없으면 앱을 껐다 켜는 수밖에 없다.
      */}
        <ScrollView
          contentContainerStyle={styles.content}
          // 키보드가 떠 있을 때 [저장] 을 누르면 첫 탭이 키보드 내리기로 먹히지 않게 한다
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={f.isFetching} onRefresh={f.refetch} />}
        >
          <View style={styles.header}>
            {/*
            가족 이름은 20자까지 받는 사용자 입력이라 「내 정보」를 밀어낼 수 있다.
            줄어드는 쪽은 이름이다 — 진입점이 화면 밖으로 나가면 이 탭에서는 내 정보로
            갈 길이 아예 없어진다 (승인 대기·온보딩과 달리 여기는 진입점이 하나뿐이다).
          */}
            <Text style={styles.title} numberOfLines={1}>
              {f.family?.name ?? '가족'}
            </Text>
            {/*
              탭을 늘리지 않는다 — 계정 쪽 일은 한 달에 몇 번이라 헤더에 하나면 된다.
              다만 색 글자 한 줄은 버튼으로 안 읽혀 찾게 된다 (실사용 후기 2026-09-17) — 바탕을 깐 알약으로 둔다
            */}
            <PressableScale
              onPress={() => router.push('/me')}
              hitSlop={8}
              small
              accessibilityRole="button"
              containerStyle={styles.myPageWrap}
              style={styles.myPageTap}
            >
              <Text style={styles.myPage}>내 정보</Text>
            </PressableScale>
          </View>

          {f.isLoading ? <Loading /> : null}
          {f.isError ? <QueryError error={f.error} onRetry={f.refetch} /> : null}

          {f.family ? (
            <>
              <Card style={{ gap: space.md }}>
                <Text style={styles.cardTitle}>초대코드</Text>
                <Muted>
                  이 코드를 카톡으로 보내면 가족이 참여를 요청할 수 있어요. 요청이 오면
                  {f.iAmOwner ? ' 여기서 승인해야' : ' 가족장이 승인해야'} 가계부가 열려요.
                </Muted>

                <Pressable onPress={f.copyCode} style={styles.codeBox}>
                  <Text style={styles.code}>{f.family.inviteCode}</Text>
                  <Text style={styles.copyHint}>{f.copied ? '복사했어요' : '눌러서 복사'}</Text>
                </Pressable>

                {f.iAmOwner ? (
                  <Button
                    label="새 코드 만들기"
                    variant="ghost"
                    loading={f.rotating}
                    onPress={() =>
                      confirm({
                        title: '새 코드 만들기',
                        body: '지금 코드는 더 이상 쓸 수 없게 돼요.',
                        confirmLabel: '만들기',
                        onConfirm: f.rotateCode,
                      })
                    }
                  />
                ) : null}
              </Card>

              <SettlementCard
                settlement={f.mySettlement}
                hint={f.settlementHint}
                pushState={f.pushState}
                error={f.settlementError}
                busy={f.savingSettlement}
                onEdit={f.openSettlement}
                onClear={f.clearSettlement}
                onEnablePush={f.enablePush}
              />

              {f.iAmOwner && f.requests.length > 0 ? (
                <JoinRequestsCard
                  requests={f.requests}
                  busy={f.busy}
                  onApprove={f.approve}
                  onReject={f.reject}
                />
              ) : null}

              <MembersCard
                members={f.members}
                iAmOwner={f.iAmOwner}
                familyName={f.family.name}
                contents={f.contents}
                canLeave={Boolean(f.myMembership)}
                ownerExit={f.ownerExit}
                busy={f.busy}
                onManage={f.manageMember}
                onLeave={f.leave}
                onDeleteFamily={f.deleteFamily}
                name={{
                  draft: f.nameDraft,
                  error: f.nameError,
                  saving: f.savingName,
                  onEdit: f.editName,
                  onChange: f.changeName,
                  onCancel: f.cancelName,
                  onSave: f.saveName,
                }}
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <SettlementSheet
        draft={f.settlementDraft}
        error={f.settlementError}
        saving={f.savingSettlement}
        onChange={f.editSettlement}
        onSave={f.saveSettlement}
        onClose={f.closeSettlement}
      />
      <MemberActionsSheet
        member={f.managedMember}
        busy={f.busy}
        onHandOver={f.handOver}
        onRemove={f.remove}
        onClose={f.closeManage}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  fill: { flex: 1 },
  content: { padding: t.space.lg, gap: t.space.lg, paddingBottom: t.space.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: t.space.md,
    paddingHorizontal: t.space.xs,
  },
  title: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink, flexShrink: 1 },
  // 줄어들지 않는 쪽은 바깥 컨테이너다 — PressableScale 은 레이아웃을 containerStyle 로 받는다
  myPageWrap: { flexShrink: 0 },
  myPageTap: {
    backgroundColor: t.colors.primarySoft,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.sm,
  },
  myPage: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.primary },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },

  codeBox: {
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.md,
    paddingVertical: t.space.lg,
    alignItems: 'center',
    gap: t.space.xs,
  },
  code: { ...t.font.code, fontWeight: t.weight.heavy, color: t.colors.ink },
  copyHint: { ...t.font.caption, color: t.colors.inkFaint },
}));
