import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/shared/api/client';
import { type EntryLine, needsReason, updateLine } from '@/entities/entry';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { AmountInput, Button, Card, ErrorText, Field, Input, Muted } from '@/shared/ui';
import { formatAmount, formatWon } from '@/shared/lib/format';
import { useStepStyles } from '../styles';

/**
 * 스텝 1..n — 수입 / 고정비.
 *
 * 금액을 고치면 사유 칸이 그 자리에서 펼쳐지고, 사유 없이는 다음으로 못 간다.
 * 여기서 막는 건 안내일 뿐이고 최종 판정은 서버가 한다.
 */
export function LineStep({
  entryId,
  line,
  isIncome,
  error,
  setError,
  onSaved,
}: {
  entryId: string;
  line: EntryLine;
  isIncome: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const stepStyles = useStepStyles();
  const { space } = useTheme();
  const [amount, setAmount] = useState<number | null>(line.actualAmount ?? line.plannedAmount);
  const [reason, setReason] = useState(line.changeReason ?? '');

  const reasonNeeded = needsReason(line.plannedAmount, amount);

  const save = useMutation({
    mutationFn: () =>
      updateLine(entryId, line.id, {
        actualAmount: amount ?? 0,
        changeReason: reason.trim() || null,
      }),
    onSuccess: onSaved,
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '저장하지 못했어요.'),
  });

  function next() {
    setError(null);

    if (amount === null) {
      setError('금액을 적어주세요. 안 냈다면 0원으로 두면 돼요.');
      return;
    }
    if (reasonNeeded && !reason.trim()) {
      setError('금액이 달라졌어요. 이번 달에 왜 이랬는지 한 줄만 적어주세요.');
      return;
    }

    save.mutate();
  }

  return (
    <ScrollView contentContainerStyle={stepStyles.body} keyboardShouldPersistTaps="handled">
      {!isIncome ? <Text style={styles.category}>{line.category}</Text> : null}

      <Text style={stepStyles.question}>
        {isIncome ? '이번 달 수입은\n얼마나 들어왔나요?' : line.name}
      </Text>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <AmountInput value={amount} onChange={setAmount} autoFocus />
        <DiffHint planned={line.plannedAmount} source={line.plannedSource} amount={amount} />
      </View>

      {reasonNeeded ? (
        <Card style={styles.reasonCard}>
          <Field label="왜 달라졌나요?" hint="지금 적어두면 몇 달 뒤에 이 한 줄이 크게 쓰여요.">
            <Input
              value={reason}
              onChangeText={setReason}
              placeholder={isIncome ? '상여금이 나왔다' : '에어컨을 많이 틀었다'}
              maxLength={200}
              // autoFocus 를 주면 안 된다. 금액을 아직 치고 있는 중에 카드가 나타나면서
              // 포커스를 뺏어가 남은 숫자가 사유 칸으로 들어간다. (에뮬레이터에서 실제로 겪음)
            />
          </Field>
        </Card>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <View style={{ gap: space.md, marginTop: space.lg }}>
        {!isIncome && amount !== 0 ? (
          <Button label="이번 달은 안 냈어요" variant="ghost" onPress={() => setAmount(0)} />
        ) : null}
        <Button label="다음" onPress={next} loading={save.isPending} />
      </View>
    </ScrollView>
  );
}

/** 기본값과 얼마나 다른지 한 줄로 알려준다. 같으면 "같아요"로 안심시키고 넘긴다. */
function DiffHint({
  planned,
  source,
  amount,
}: {
  planned: number | null;
  source: EntryLine['plannedSource'];
  amount: number | null;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (planned === null) {
    return <Muted>지난달 기록이 없어요. 이번 달 금액을 적어주세요.</Muted>;
  }

  const base = source === 'FIXED_DEFAULT' ? '등록한 금액' : '지난달';

  if (amount === null || amount === planned) {
    return (
      <Text style={styles.hintSame}>
        {base}과 같아요 · {formatWon(planned)}
      </Text>
    );
  }

  const delta = amount - planned;
  return (
    <Text style={[styles.hintDiff, { color: delta > 0 ? colors.up : colors.down }]}>
      {base}보다 {formatAmount(Math.abs(delta))}원 {delta > 0 ? '많아요' : '적어요'}
    </Text>
  );
}

const useStyles = makeStyles((t) => ({
  category: { ...t.font.small, color: t.colors.primary, fontWeight: t.weight.bold, marginBottom: t.space.xs },
  hintSame: { ...t.font.small, color: t.colors.inkFaint, textAlign: 'right' },
  hintDiff: { ...t.font.small, fontWeight: t.weight.bold, textAlign: 'right' },
  reasonCard: { marginTop: t.space.lg, backgroundColor: t.colors.upSoft, borderColor: t.colors.upSoft },
}));
