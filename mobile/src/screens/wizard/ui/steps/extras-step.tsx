import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  type Entry,
  addExtraIncomeLine,
  addExtraLine,
  deleteLine,
  entryKeys,
} from '@/entities/entry';
import { CATEGORIES, type Category } from '@/shared/model/types';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { AmountInput, Button, Card, Chip, ErrorText, Field, Input, Muted } from '@/shared/ui';
import { formatWon } from '@/shared/lib/format';
import { MESSAGES } from '@/shared/config/messages';
import { errorMessage } from '@/shared/lib/errors';
import { useStepStyles } from '../styles';

const VARIANTS = {
  expense: {
    kind: 'EXTRA' as const,
    question: '이번 달에 추가로\n나간 돈이 있나요?',
    hint: '고정비에 없는, 이번 달에만 있었던 지출이에요.',
    nameLabel: '무엇에 쓴 돈인가요?',
    placeholder: '형 결혼식 축의금',
  },
  income: {
    kind: 'EXTRA_INCOME' as const,
    question: '이번 달에 월급 말고\n더 들어온 돈이 있나요?',
    hint: '상여금 · 환급 · 부업처럼 이번 달에만 들어온 돈이에요.',
    nameLabel: '어디서 들어온 돈인가요?',
    placeholder: '추석 상여금',
  },
};

/**
 * 그 달에만 있는 줄을 목록으로 적는 스텝 — 두 얼굴이 있다.
 *   expense  스텝 n+1 추가 지출. 고정비에 없는, 그 달에만 있었던 지출
 *   income   스텝 1.5 기타 수입. 월급 말고 그 달만 들어온 돈 (F-ENT-12)
 * 둘 다 사유를 묻지 않는다 — 이름이 곧 사유다. 다른 점은 분류 칩이 있느냐뿐이라 화면 하나로 둔다.
 */
export function ExtrasStep({
  entry,
  variant = 'expense',
  onNext,
}: {
  entry: Entry;
  variant?: keyof typeof VARIANTS;
  onNext: () => void;
}) {
  const styles = useStyles();
  const stepStyles = useStepStyles();
  const { space } = useTheme();
  const queryClient = useQueryClient();
  const copy = VARIANTS[variant];
  const isIncome = variant === 'income';
  const extras = entry.lines.filter((line) => line.kind === copy.kind);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('기타');
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: entryKeys.detail(entry.id) });

  const add = useMutation({
    mutationFn: () =>
      isIncome
        ? addExtraIncomeLine(entry.id, { name: name.trim(), actualAmount: amount ?? 0 })
        : addExtraLine(entry.id, { name: name.trim(), category, actualAmount: amount ?? 0 }),
    onSuccess: () => {
      setName('');
      setAmount(null);
      setCategory('기타');
      setAdding(false);
      setError(null);
      void refresh();
    },
    onError: (caught) => setError(errorMessage(caught, MESSAGES.saveFailed)),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => deleteLine(entry.id, lineId),
    onSuccess: () => void refresh(),
  });

  return (
    <ScrollView contentContainerStyle={stepStyles.body} keyboardShouldPersistTaps="handled">
      <Text style={stepStyles.question}>{copy.question}</Text>
      <Muted>{copy.hint}</Muted>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {extras.map((line) => (
          <View key={line.id} style={styles.extraRow}>
            <View style={{ flex: 1, gap: space.xxs }}>
              <Text style={styles.extraName}>{line.name}</Text>
              {/* 기타 수입은 분류가 없다 — 내부값 '수입' 을 보여줄 이유가 없다 */}
              {isIncome ? null : <Text style={styles.extraMeta}>{line.category}</Text>}
            </View>
            <Text style={styles.extraAmount}>{formatWon(line.actualAmount ?? 0)}</Text>
            <Pressable
              onPress={() => remove.mutate(line.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${line.name} 지우기`}
            >
              <Text style={styles.removeIcon}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {adding ? (
        <Card style={{ gap: space.lg, marginTop: space.md }}>
          <Field label={copy.nameLabel} hint="이름이 곧 이유예요. 사유는 따로 묻지 않아요.">
            <Input
              value={name}
              onChangeText={setName}
              placeholder={copy.placeholder}
              maxLength={30}
              autoFocus
            />
          </Field>

          {isIncome ? null : (
            <Field label="분류">
              <View style={stepStyles.chips}>
                {CATEGORIES.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    selected={category === item}
                    onPress={() => setCategory(item)}
                  />
                ))}
              </View>
            </Field>
          )}

          <Field label="금액">
            <AmountInput size="md" value={amount} onChange={setAmount} calculator />
          </Field>

          <ErrorText>{error}</ErrorText>

          <Button
            label="추가"
            onPress={() => {
              if (!name.trim()) {
                setError('항목 이름을 적어주세요.');
                return;
              }
              add.mutate();
            }}
            loading={add.isPending}
          />
          <Button label="취소" variant="ghost" onPress={() => setAdding(false)} />
        </Card>
      ) : (
        <Button
          label="+ 항목 추가"
          variant="ghost"
          onPress={() => setAdding(true)}
          style={{ marginTop: space.md }}
        />
      )}

      <View style={{ marginTop: space.xl }}>
        <Button label={extras.length === 0 ? '없어요' : '다음'} onPress={onNext} />
      </View>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space.md,
    backgroundColor: t.colors.surface,
    borderWidth: t.border.hairline,
    borderColor: t.colors.line,
    borderRadius: t.radius.md,
    padding: t.space.md,
  },
  extraName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  extraMeta: { ...t.font.caption, color: t.colors.inkFaint },
  extraAmount: {
    ...t.font.body,
    color: t.colors.ink,
    fontWeight: t.weight.bold,
    fontVariant: ['tabular-nums' as const],
  },
  removeIcon: { ...t.font.headline, color: t.colors.inkFaint },
}));
