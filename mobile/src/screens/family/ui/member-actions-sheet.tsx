import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { FamilyDetail } from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { confirm } from '@/shared/lib/confirm';
import { PressableScale, Sheet } from '@/shared/ui';

type Member = FamilyDetail['members'][number];

/**
 * 가족장이 구성원 한 사람에게 할 수 있는 일 — 가족장 넘기기 · 내보내기 (F-FAM-08 · F-FAM-09).
 * member 가 없으면 닫혀 있다.
 *
 * 줄마다 큰 버튼 두 개를 달면 구성원이 늘수록 목록이 버튼 더미가 된다 (실사용 후기 2026-09-17).
 * 둘 다 한 달에 한 번도 안 쓰는 동작이라 줄에는 [관리] 하나만 두고 여기로 모았다.
 *
 * 확인 다이얼로그는 시트를 닫지 않고 그 위에 띄운다 — [취소] 하면 시트로 돌아와 다른 쪽을 고를 수 있다.
 * 실행하면 시트를 닫는 것은 훅의 몫이다. (고정비 시트의 [지우기] 와 같은 모양)
 */
export function MemberActionsSheet({
  member,
  busy,
  onHandOver,
  onRemove,
  onClose,
}: {
  member: Member | null;
  busy: boolean;
  onHandOver: (membershipId: string) => void;
  onRemove: (membershipId: string) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Sheet
      visible={member !== null}
      onClose={onClose}
      title={member ? `${member.displayName}님` : ''}
      dismissOnBackdrop
    >
      {member ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.lg }]}
        >
          <PressableScale
            accessibilityRole="button"
            disabled={busy}
            style={[styles.action, busy && styles.disabled]}
            onPress={() =>
              confirm({
                title: '가족장 넘기기',
                body: `${member.displayName}님이 가족장이 되고, 나는 일반 구성원이 돼요.`,
                confirmLabel: '넘기기',
                onConfirm: () => onHandOver(member.id),
              })
            }
          >
            <Text style={styles.actionLabel}>가족장 넘기기</Text>
            <Text style={styles.actionHint}>
              초대코드와 참여 요청은 {member.displayName}님이 맡게 돼요.
            </Text>
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            disabled={busy}
            style={[styles.action, busy && styles.disabled]}
            onPress={() =>
              confirm({
                title: `${member.displayName}님 내보내기`,
                body: '앞으로의 장부에서 빠져요. 지금까지 적은 기록은 그대로 남아요.',
                confirmLabel: '내보내기',
                destructive: true,
                onConfirm: () => onRemove(member.id),
              })
            }
          >
            <Text style={[styles.actionLabel, styles.danger]}>내보내기</Text>
            <Text style={styles.actionHint}>지금까지 적은 기록은 그대로 남아요.</Text>
          </PressableScale>
        </ScrollView>
      ) : null}
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  content: { paddingHorizontal: t.space.xl, gap: t.space.sm },
  // 시트 바탕(bg) 위에서 누를 수 있는 것으로 읽히게 한 단 밝게 · 테두리를 둔다 — 정산일 시트의 칩과 같은 조합
  action: {
    backgroundColor: t.colors.surface,
    borderWidth: t.border.hairline,
    borderColor: t.colors.line,
    borderRadius: t.radius.lg,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md,
    gap: t.space.xxs,
  },
  disabled: { opacity: t.opacity.disabled },
  actionLabel: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  // 되돌리기 어려운 동작의 색이다 — 확인 다이얼로그의 붉은 실행 버튼과 같은 뜻
  danger: { color: t.colors.danger },
  actionHint: { ...t.font.note, color: t.colors.inkFaint },
}));
