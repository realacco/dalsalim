import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useMutation } from '@tanstack/react-query';

import { type EntryLine, settledYearMonth, settlementDelta, updateLine } from '@/entities/entry';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { AmountInput, Button, ErrorText, Muted } from '@/shared/ui';
import { formatAmount, formatMonthShort, formatWon } from '@/shared/lib/format';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from '@/shared/lib/errors';
import { useStepStyles } from '../styles';

/**
 * 스텝 0 — 지난달 결산 (F-ENT-11).
 *
 * "지난달에 생활비로 50만 원을 옮겼는데, 실제로는 얼마나 썼나요?" 를 묻는다.
 * 사유는 없다 — 옮긴 돈을 얼마나 썼는지는 정정이지 변화가 아니다. 건너뛰기도 없다 —
 * 기본값(옮긴 금액) 그대로 [다음] 을 누르면 "옮긴 만큼 썼다" 로 확정된다.
 */
export function SettlementStep({
  entryId,
  yearMonth,
  line,
  error,
  setError,
  onSaved,
}: {
  entryId: string;
  yearMonth: string;
  line: EntryLine;
  error: string | null;
  setError: (value: string | null) => void;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const stepStyles = useStepStyles();
  const { space } = useTheme();
  const planned = line.plannedAmount ?? 0;
  const [amount, setAmount] = useState<number | null>(line.actualAmount ?? line.plannedAmount);

  const lastMonth = formatMonthShort(settledYearMonth(yearMonth));
  const thisMonth = formatMonthShort(yearMonth);

  const save = useMutation({
    mutationFn: () => updateLine(entryId, line.id, { actualAmount: amount ?? 0 }),
    onSuccess: onSaved,
    onError: (caught) => setError(errorMessage(caught, MESSAGES.saveFailed)),
  });

  function next() {
    setError(null);
    if (amount === null) {
      setError('실제로 쓴 금액을 적어주세요. 하나도 안 썼다면 0원으로 두면 돼요.');
      return;
    }
    save.mutate();
  }

  return (
    <ScrollView contentContainerStyle={stepStyles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.category}>
        {lastMonth} 결산 · {line.category}
      </Text>

      <Text style={stepStyles.question}>
        {lastMonth}에 {line.name}으로{'\n'}
        {formatWon(planned)}을 옮겼어요.{'\n'}실제로는 얼마나 썼나요?
      </Text>

      {/*
        이름·분류는 지난달 스냅샷이지만 설명은 지금 항목의 것이다 — 설명은 "이게 무엇인지" 를 알려주는
        힌트라 항상 최신이 맞다 (services/entry.ts 의 serializeEntry 참조). 고정비 스텝과 같은 규칙이다.
      */}
      {line.description ? <Text style={styles.description}>{line.description}</Text> : null}

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <AmountInput value={amount} onChange={setAmount} autoFocus calculator />
        <SettlementHint planned={planned} amount={amount} thisMonth={thisMonth} />
      </View>

      <ErrorText>{error}</ErrorText>

      <View style={{ marginTop: space.lg }}>
        <Button label="다음" onPress={next} loading={save.isPending} />
      </View>
    </ScrollView>
  );
}

/**
 * 옮긴 것과 얼마나 다른지, 그리고 그게 이번 달 남은 돈에 어떻게 들어가는지 한 줄로.
 * 덜 쓴 것은 붉지도 푸르지도 않다 — 남은 돈이 늘지 않으므로 "남았어요" 로만 알린다.
 */
function SettlementHint({
  planned,
  amount,
  thisMonth,
}: {
  planned: number;
  amount: number | null;
  thisMonth: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const delta = settlementDelta(planned, amount);

  if (delta.kind === 'empty')
    return <Muted>옮긴 만큼 다 썼다면 그대로 [다음]을 누르면 돼요.</Muted>;
  if (delta.kind === 'same') return <Text style={styles.hintSame}>옮긴 만큼 썼어요</Text>;
  if (delta.kind === 'over') {
    return (
      <Text style={[styles.hintDiff, { color: colors.up }]}>
        옮긴 것보다 {formatAmount(delta.amount)}원 더 썼어요 · {thisMonth} 남은 돈에서 빠져요
      </Text>
    );
  }
  return <Text style={styles.hintSame}>{formatAmount(delta.amount)}원이 남았어요</Text>;
}

const useStyles = makeStyles((t) => ({
  category: {
    ...t.font.small,
    color: t.colors.primary,
    fontWeight: t.weight.bold,
    marginBottom: t.space.xs,
  },
  description: { ...t.font.small, color: t.colors.inkFaint, marginTop: t.space.xs },
  hintSame: { ...t.font.small, color: t.colors.inkFaint, textAlign: 'right' },
  hintDiff: { ...t.font.small, fontWeight: t.weight.bold, textAlign: 'right' },
}));
