import { Text, View } from 'react-native';

import { contentsLine, type FamilyContents, type FamilyDetail } from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Muted } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

type Member = FamilyDetail['members'][number];

/** 구성원 목록. 가족장만 남을 다룰 수 있고, 되돌리기 어려운 동작은 항상 확인을 받는다. */
export function MembersCard({
  members,
  familyName,
  contents,
  iAmOwner,
  canLeave,
  ownerMustHandOverFirst,
  lastOwner,
  busy,
  onHandOver,
  onRemove,
  onLeave,
  onDeleteFamily,
}: {
  members: Member[];
  familyName: string;
  /** 없앨 때 사라지는 것의 수. 확인 다이얼로그가 세어 보여준다 (F-FAM-11) */
  contents: FamilyContents | null;
  iAmOwner: boolean;
  canLeave: boolean;
  /** 가족장인데 다른 구성원이 남아 있으면 먼저 넘겨야 나갈 수 있다 */
  ownerMustHandOverFirst: boolean;
  /** 가족장인데 나 혼자다 — 나가는 게 아니라 없애는 것이다 (F-FAM-11) */
  lastOwner: boolean;
  busy: boolean;
  onHandOver: (membershipId: string) => void;
  onRemove: (membershipId: string) => void;
  onLeave: () => void;
  onDeleteFamily: () => void;
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
            <View style={{ gap: space.xxs }}>
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
        가족장은 그냥 못 나간다. 주인 없는 가족이 남기 때문인데, 남은 사람이 있고 없고에 따라
        할 일이 다르다 — 있으면 넘기고, 나 혼자면 나가는 게 아니라 없애는 것이다 (F-FAM-11).
        서버가 막지만 버튼을 눌러보고 나서 알게 되면 늦으므로 여기서 먼저 갈라 보여준다.
      */}
      {ownerMustHandOverFirst ? (
        <Muted>
          가족장은 바로 나갈 수 없어요. 위에서 다른 구성원에게 가족장을 넘긴 뒤에 나갈 수 있어요.
        </Muted>
      ) : lastOwner ? (
        <View style={{ gap: space.sm }}>
          <Muted>구성원이 나 혼자예요. 나가는 대신 가족을 없앨 수 있어요.</Muted>
          <Button
            label="가족 없애기"
            variant="ghost"
            disabled={busy}
            onPress={() =>
              confirm({
                title: '가족 없애기',
                // "정말 삭제하시겠습니까" 보다 세어 보여주는 쪽이 한 번 더 생각하게 만든다
                // 가족 이름 뒤에 이/가 를 붙이지 않는다 — "김씨네가" 와 "우리집이" 로 갈린다
                body: `${familyName} 가족이 사라지고 되돌릴 수 없어요.${contentsLine(contents)}\n초대코드도 못 쓰게 돼요.`,
                confirmLabel: '없애기',
                destructive: true,
                onConfirm: onDeleteFamily,
              })
            }
          />
        </View>
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
