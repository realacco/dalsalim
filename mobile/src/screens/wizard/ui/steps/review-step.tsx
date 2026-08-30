import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/shared/api/client';
import { type Entry, submitEntry } from '@/entities/entry';
import { colors, font, space } from '@/shared/config/theme';
import { Button, Card, Divider, ErrorText, Muted, Row } from '@/shared/ui';
import { formatAmount, formatWon } from '@/shared/lib/format';
import { stepStyles } from '../styles';

/**
 * 스텝 n+3 — 확인 후 제출.
 * 합계보다 "이번 달 달라진 것"이 이 화면의 주인공이다. 그게 이 앱이 쌓는 자산이다.
 */
export function ReviewStep({
  entry,
  onDone,
}: {
  entry: Entry;
  onDone: (complete: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const changes = entry.lines.filter(
    (line) => line.changeReason && line.plannedAmount !== null && line.actualAmount !== null,
  );

  const submit = useMutation({
    mutationFn: () => submitEntry(entry.id),
    onSuccess: (result) => onDone(result.bookStatus === 'COMPLETE'),
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '제출하지 못했어요.'),
  });

  const { income, fixedTotal, extraTotal, surplus } = entry.summary;

  return (
    <ScrollView contentContainerStyle={stepStyles.body} keyboardShouldPersistTaps="handled">
      <Text style={stepStyles.question}>이렇게 적을게요</Text>

      <Card style={{ gap: space.md, marginTop: space.lg }}>
        <Row label="수입" value={formatWon(income)} />
        <Row label="고정비" value={`− ${formatWon(fixedTotal)}`} />
        <Row label="추가 지출" value={`− ${formatWon(extraTotal)}`} />
        <Divider />
        <Row label="남은 돈" value={formatWon(surplus)} strong tone={surplus < 0 ? 'up' : 'down'} />
      </Card>

      {changes.length > 0 ? (
        <Card style={{ gap: space.md, marginTop: space.lg }}>
          <Text style={stepStyles.cardTitle}>이번 달 달라진 것 {changes.length}개</Text>
          <Divider />
          {changes.map((line) => {
            const delta = (line.actualAmount ?? 0) - (line.plannedAmount ?? 0);
            return (
              <View key={line.id} style={{ gap: 2 }}>
                <View style={styles.changeHead}>
                  <Text style={styles.changeName}>{line.name}</Text>
                  <Text style={[styles.changeDelta, { color: delta > 0 ? colors.up : colors.down }]}>
                    {delta > 0 ? '+' : '−'}
                    {formatAmount(Math.abs(delta))}
                  </Text>
                </View>
                <Text style={styles.changeReason}>{line.changeReason}</Text>
              </View>
            );
          })}
        </Card>
      ) : (
        <Muted style={{ marginTop: space.lg }}>이번 달은 지난달과 똑같았어요.</Muted>
      )}

      {entry.note ? (
        <Card style={{ gap: space.sm, marginTop: space.lg }}>
          <Text style={stepStyles.cardTitle}>이번 달 특이사항</Text>
          <Text style={styles.noteText}>{entry.note}</Text>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <View style={{ marginTop: space.xl }}>
        <Button label="제출하기" onPress={() => submit.mutate()} loading={submit.isPending} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  changeHead: { flexDirection: 'row', justifyContent: 'space-between' },
  changeName: { ...font.body, color: colors.ink, fontWeight: '600' },
  changeDelta: { ...font.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  changeReason: { ...font.small, color: colors.inkSoft },
  noteText: { ...font.body, color: colors.inkSoft },
});
