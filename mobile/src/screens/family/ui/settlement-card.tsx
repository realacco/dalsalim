import { Text, View } from 'react-native';

import { formatSettlement, shortMonthHint } from '@/entities/family';
import type { PushState } from '@/features/push';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import type { Settlement } from '@/shared/model/types';
import { Button, Card, ErrorText, Muted, Notice } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

/** 내 정산일. 정하면 그날 그 시각에 알림이 온다 (F-FAM-10) */
export function SettlementCard({
  settlement,
  pushState,
  error,
  busy,
  onEdit,
  onClear,
}: {
  settlement: Settlement | null;
  /** 마지막 저장 때 알림 권한이 어떻게 됐나. 아직 저장한 적 없으면 null */
  pushState: PushState | null;
  error: string | null;
  busy: boolean;
  onEdit: () => void;
  onClear: () => void;
}) {
  const styles = useStyles();
  const { space } = useTheme();
  const hint = settlement ? shortMonthHint(settlement.day) : null;

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.cardTitle}>내 정산일</Text>

      {settlement ? (
        <View style={{ gap: space.xxs }}>
          <Text style={styles.value}>{formatSettlement(settlement)}</Text>
          <Muted>이날 이 시각에 "살림 적을 때예요" 하고 알려드려요.</Muted>
          {hint ? <Muted>{hint}</Muted> : null}
        </View>
      ) : (
        <Muted>정산일을 정해두면 그날 알림으로 알려드려요. 사람마다 달라도 돼요.</Muted>
      )}

      {pushState === 'denied' ? (
        <Notice>알림이 꺼져 있어요. 폰 설정에서 달살림 알림을 켜면 그날 알려드려요.</Notice>
      ) : null}
      {pushState === 'unavailable' ? (
        <Notice>이 기기에서는 알림을 받을 수 없어요. 정산일은 저장돼요.</Notice>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={settlement ? '바꾸기' : '정하기'}
          variant={settlement ? 'ghost' : 'primary'}
          disabled={busy}
          style={{ flex: 1 }}
          onPress={onEdit}
        />
        {settlement ? (
          <Button
            label="안 받기"
            variant="ghost"
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() =>
              confirm({
                title: '알림 안 받기',
                body: '정산일이 지워지고 알림이 안 와요.',
                confirmLabel: '안 받기',
                destructive: true,
                onConfirm: onClear,
              })
            }
          />
        ) : null}
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  value: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.primary },
  actions: { flexDirection: 'row', gap: t.space.sm },
}));
