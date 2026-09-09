import { Text, View } from 'react-native';

import type { BookView } from '@/entities/book';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Card, Divider, Row } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';
import { formatWon } from '@/shared/lib/format';

type Mine = BookView['members'][number];

/** 내 기록 카드 — 제출 전에는 시작/이어서 버튼, 제출 뒤에는 요약과 [수정하기] */
export function MyCard({
  status,
  progress,
  summary,
  busy,
  canDelete,
  onStart,
  onEdit,
  onDelete,
}: {
  status: Mine['status'];
  progress: Mine['progress'];
  summary: Mine['summary'];
  busy: boolean;
  canDelete: boolean;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const { space } = useTheme();

  if (status === 'SUBMITTED' && summary) {
    return (
      <Card style={{ gap: space.md }}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>내 기록</Text>
          <Text style={styles.badge}>제출 완료</Text>
        </View>

        <Row label="수입" value={formatWon(summary.income)} />
        <Row label="고정비" value={`− ${formatWon(summary.fixedTotal)}`} />
        <Row label="추가 지출" value={`− ${formatWon(summary.extraTotal)}`} />
        <Divider />
        <Row
          label="남은 돈"
          value={formatWon(summary.surplus)}
          strong
          tone={summary.surplus < 0 ? 'up' : 'down'}
        />

        <Button label="수정하기" variant="ghost" onPress={onEdit} loading={busy} />
      </Card>
    );
  }

  const writing = status === 'DRAFT';

  return (
    <Card style={{ gap: space.md }}>
      <Text style={styles.cardTitle}>내 기록</Text>
      <Text style={styles.prompt}>
        {writing
          ? `적다가 멈춘 곳부터 이어서 쓸 수 있어요.${
              progress ? `\n${progress.step}단계 / ${progress.total}단계` : ''
            }`
          : '월급부터 고정비까지 한 항목씩 물어볼게요.\n오래 걸리지 않아요.'}
      </Text>
      <Button
        label={writing ? '이어서 작성하기' : '이번 달 기록 시작하기'}
        onPress={onStart}
        loading={busy}
      />

      {/*
        작성 중인 이번 달 기록만 지울 수 있다 (F-ENT-10). 제출 완료 카드에는 아예 없다 —
        지우려면 [수정하기]로 되열어야 하고, 그 한 단계가 곧 문턱이다.
      */}
      {canDelete ? (
        <Button
          label="이 기록 지우기"
          variant="ghost"
          loading={busy}
          onPress={() =>
            confirm({
              title: '이번 달 기록 지우기',
              // 첫 달에는 지난달 기록이 없어 고정비 등록 금액이 들어간다.
              // 어느 쪽이든 "미리 채워진다"는 사실은 같으므로 근거를 약속하지 않는다
              body: '적어둔 금액이 모두 없어져요. 다시 시작하면 금액이 미리 채워진 채로 열려요.',
              confirmLabel: '지우기',
              destructive: true,
              onConfirm: onDelete,
            })
          }
        />
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((t) => ({
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  prompt: { ...t.font.body, color: t.colors.inkSoft },
  badge: {
    ...t.font.caption,
    fontWeight: t.weight.bold,
    paddingHorizontal: t.space.md,
    paddingVertical: t.space.xs,
    borderRadius: t.radius.pill,
    overflow: 'hidden',
    backgroundColor: t.colors.primarySoft,
    color: t.colors.primary,
  },
}));
