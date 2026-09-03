import { Text, View } from 'react-native';

import type { FamilyDetail } from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Muted } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

type Member = FamilyDetail['members'][number];

/** 구성원 목록. 가족장만 남을 다룰 수 있고, 되돌리기 어려운 동작은 항상 확인을 받는다. */
export function MembersCard({
  members,
  iAmOwner,
  canLeave,
  ownerMustHandOverFirst,
  busy,
  onHandOver,
  onRemove,
  onLeave,
}: {
  members: Member[];
  iAmOwner: boolean;
  canLeave: boolean;
  /** 가족장인데 다른 구성원이 남아 있으면 먼저 넘겨야 나갈 수 있다 */
  ownerMustHandOverFirst: boolean;
  busy: boolean;
  onHandOver: (membershipId: string) => void;
  onRemove: (membershipId: string) => void;
  onLeave: () => void;
}) {
  const styles = useStyles();
  const { space } = useTheme();

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.cardTitle}>구성원 {members.length}명</Text>
      <Divider />

      {members.map((member) => (
        <View key={member.id} style={styles.member}>
          <View style={styles.memberRow}>
            <View style={{ gap: 2 }}>
              <Text style={styles.memberName}>
                {member.displayName}
                {member.isMe ? ' (나)' : ''}
              </Text>
              <Text style={styles.memberMeta}>{member.nickname}</Text>
            </View>
            {member.role === 'OWNER' ? <Text style={styles.ownerTag}>가족장</Text> : null}
          </View>

          {iAmOwner && !member.isMe ? (
            <View style={styles.memberActions}>
              <Button
                label="가족장 넘기기"
                variant="ghost"
                disabled={busy}
                style={{ flex: 1 }}
                onPress={() =>
                  confirm({
                    title: '가족장 넘기기',
                    body: `${member.displayName}님이 가족장이 되고, 나는 일반 구성원이 돼요.`,
                    confirmLabel: '넘기기',
                    onConfirm: () => onHandOver(member.id),
                  })
                }
              />
              <Button
                label="내보내기"
                variant="ghost"
                disabled={busy}
                style={{ flex: 1 }}
                onPress={() =>
                  confirm({
                    title: `${member.displayName}님 내보내기`,
                    body: '앞으로의 장부에서 빠져요. 지금까지 적은 기록은 그대로 남아요.',
                    confirmLabel: '내보내기',
                    destructive: true,
                    onConfirm: () => onRemove(member.id),
                  })
                }
              />
            </View>
          ) : null}
        </View>
      ))}

      <Divider />

      {/*
        가족장이 그냥 나가면 주인 없는 가족이 남는다. 서버가 막지만,
        버튼을 눌러보고 나서 알게 되면 늦으므로 여기서 먼저 안내한다.
      */}
      {ownerMustHandOverFirst ? (
        <Muted>
          가족장은 바로 나갈 수 없어요. 위에서 다른 구성원에게 가족장을 넘긴 뒤에 나갈 수 있어요.
        </Muted>
      ) : (
        <Button
          label="가족에서 나가기"
          variant="ghost"
          disabled={busy || !canLeave}
          onPress={() =>
            confirm({
              title: '가족에서 나가기',
              body: '앞으로의 장부에서 빠져요. 지금까지 적은 기록은 그대로 남아요.',
              confirmLabel: '나가기',
              destructive: true,
              onConfirm: onLeave,
            })
          }
        />
      )}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  member: { gap: t.space.sm, paddingVertical: t.space.xs },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberActions: { flexDirection: 'row', gap: t.space.sm },
  memberName: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },
  memberMeta: { ...t.font.caption, color: t.colors.inkFaint },
  ownerTag: {
    ...t.font.caption,
    fontWeight: t.weight.bold,
    color: t.colors.primary,
    backgroundColor: t.colors.primarySoft,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
  },
}));
