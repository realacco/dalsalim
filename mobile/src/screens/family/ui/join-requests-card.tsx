import { Text, View } from 'react-native';

import type { JoinRequest } from '@/entities/family';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Muted } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

/**
 * 초대코드는 카톡으로 오가다 새어나갈 수 있다. 코드를 맞힌 사람은 여기 대기로 걸리고,
 * 가족장이 승인해야 가계부를 볼 수 있다. 알림이 아직 없어서 이 카드가 유일한 통로다 —
 * 그래서 요청이 있으면 구성원 목록보다 위에 둔다.
 */
export function JoinRequestsCard({
  requests,
  busy,
  onApprove,
  onReject,
}: {
  requests: JoinRequest[];
  busy: boolean;
  onApprove: (membershipId: string) => void;
  onReject: (membershipId: string) => void;
}) {
  const styles = useStyles();
  const { space } = useTheme();

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.cardTitle}>참여 요청 {requests.length}건</Text>
      <Muted>초대코드를 넣은 사람이에요. 아는 사람이 맞는지 확인하고 승인해주세요.</Muted>
      <Divider />

      {requests.map((request) => (
        <View key={request.id} style={styles.member}>
          <View style={{ gap: 2 }}>
            <Text style={styles.memberName}>{request.displayName}</Text>
            <Text style={styles.memberMeta}>{request.nickname}</Text>
          </View>

          <View style={styles.memberActions}>
            <Button
              label="승인"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() =>
                confirm({
                  title: `${request.displayName}님 승인`,
                  body: '승인하면 우리 가족의 가계부를 볼 수 있고, 이번 달 장부에도 함께 들어가요.',
                  confirmLabel: '승인',
                  onConfirm: () => onApprove(request.id),
                })
              }
            />
            <Button
              label="거절"
              variant="ghost"
              disabled={busy}
              style={{ flex: 1 }}
              onPress={() =>
                confirm({
                  title: `${request.displayName}님 거절`,
                  body: '요청이 사라져요. 모르는 사람이면 초대코드도 새로 만드는 게 좋아요.',
                  confirmLabel: '거절',
                  destructive: true,
                  onConfirm: () => onReject(request.id),
                })
              }
            />
          </View>
        </View>
      ))}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  member: { gap: t.space.sm, paddingVertical: t.space.xs },
  memberActions: { flexDirection: 'row', gap: t.space.sm },
  memberName: { ...t.font.body, fontWeight: t.weight.bold, color: t.colors.ink },
  memberMeta: { ...t.font.caption, color: t.colors.inkFaint },
}));
