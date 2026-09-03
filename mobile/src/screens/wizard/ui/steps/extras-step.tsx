import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '@/shared/api/client';
import { type Entry, addExtraLine, deleteLine, entryKeys } from '@/entities/entry';
import { CATEGORIES, type Category } from '@/shared/model/types';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { AmountInput, Button, Card, Chip, ErrorText, Field, Input, Muted } from '@/shared/ui';
import { formatWon } from '@/shared/lib/format';
import { useStepStyles } from '../styles';

/**
 * 스텝 n+1 — 추가 지출.
 * 고정비에 없는, 그 달에만 있었던 지출이다. 사유를 묻지 않는다 — 이름이 곧 사유다.
 */
export function ExtrasStep({ entry, onNext }: { entry: Entry; onNext: () => void }) {
  const styles = useStyles();
  const stepStyles = useStepStyles();
  const { space } = useTheme();
  const queryClient = useQueryClient();
  const extras = entry.lines.filter((line) => line.kind === 'EXTRA');

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('기타');
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: entryKeys.detail(entry.id) });

  const add = useMutation({
    mutationFn: () =>
      addExtraLine(entry.id, { name: name.trim(), category, actualAmount: amount ?? 0 }),
    onSuccess: () => {
      setName('');
      setAmount(null);
      setCategory('기타');
      setAdding(false);
      setError(null);
      void refresh();
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '추가하지 못했어요.'),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) => deleteLine(entry.id, lineId),
    onSuccess: () => void refresh(),
  });

  return (
    <ScrollView contentContainerStyle={stepStyles.body} keyboardShouldPersistTaps="handled">
      <Text style={stepStyles.question}>이번 달에 추가로{'\n'}나간 돈이 있나요?</Text>
      <Muted>고정비에 없는, 이번 달에만 있었던 지출이에요.</Muted>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {extras.map((line) => (
          <View key={line.id} style={styles.extraRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.extraName}>{line.name}</Text>
              <Text style={styles.extraMeta}>{line.category}</Text>
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
          <Field label="무엇에 쓴 돈인가요?" hint="이름이 곧 이유예요. 사유는 따로 묻지 않아요.">
            <Input
              value={name}
              onChangeText={setName}
              placeholder="형 결혼식 축의금"
              maxLength={30}
              autoFocus
            />
          </Field>

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

          <Field label="금액">
            <AmountInput size="md" value={amount} onChange={setAmount} allowSum />
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
    borderWidth: 1,
    borderColor: t.colors.line,
    borderRadius: t.radius.md,
    padding: t.space.md,
  },
  extraName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  extraMeta: { ...t.font.caption, color: t.colors.inkFaint },
  extraAmount: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.bold, fontVariant: ['tabular-nums' as const] },
  removeIcon: { ...t.font.headline, color: t.colors.inkFaint },
}));
