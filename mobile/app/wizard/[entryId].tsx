import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError, api } from '../../src/api/client';
import { CATEGORIES, type Category, type Entry, type EntryLine } from '../../src/api/types';
import { useSession } from '../../src/store/session';
import { colors, font, radius, space } from '../../src/theme';
import {
  AmountInput,
  Button,
  Card,
  Chip,
  Divider,
  ErrorText,
  Field,
  Input,
  Loading,
  Muted,
  ProgressBar,
  Row,
} from '../../src/components/ui';
import { formatAmount, formatWon, formatYearMonth } from '../../src/lib/format';

type Step =
  | { kind: 'line'; line: EntryLine }
  | { kind: 'extras' }
  | { kind: 'note' }
  | { kind: 'review' };

/**
 * 스텝 입력 위저드 — 이 앱의 심장.
 *
 * 한 화면에 질문 하나. 기본값은 서버가 지난달 기록으로 채워서 내려준다.
 * 금액을 고치면 사유 칸이 그 자리에서 펼쳐지고, 사유 없이는 다음으로 못 간다.
 * (그 규칙의 최종 판단은 서버가 한다 — 여기서는 미리 안내만 한다)
 */
export default function WizardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const familyId = useSession((state) => state.familyId);
  const { entryId } = useLocalSearchParams<{ entryId: string }>();

  const [index, setIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entryQuery = useQuery({
    queryKey: ['entry', entryId],
    queryFn: () => api<{ entry: Entry }>(`/entries/${entryId}`).then((r) => r.entry),
    enabled: Boolean(entryId),
  });

  const entry = entryQuery.data;

  const steps = useMemo<Step[]>(() => {
    if (!entry) return [];

    const income = entry.lines.filter((l) => l.kind === 'INCOME');
    const fixed = entry.lines.filter((l) => l.kind === 'FIXED');

    return [
      ...income.map((line) => ({ kind: 'line', line }) as Step),
      ...fixed.map((line) => ({ kind: 'line', line }) as Step),
      { kind: 'extras' },
      { kind: 'note' },
      { kind: 'review' },
    ];
  }, [entry]);

  // 서버가 기억하고 있던 위치에서 이어서 연다
  useEffect(() => {
    if (entry && index === null) {
      setIndex(Math.min(entry.cursor, Math.max(steps.length - 1, 0)));
    }
  }, [entry, index, steps.length]);

  const saveCursor = useMutation({
    mutationFn: (cursor: number) => api(`/entries/${entryId}`, { method: 'PATCH', body: { cursor } }),
  });

  function goTo(next: number) {
    setError(null);
    setIndex(next);
    if (entry?.status === 'DRAFT') saveCursor.mutate(next);
  }

  if (entryQuery.isLoading || index === null || !entry) {
    return (
      <SafeAreaView style={styles.screen}>
        <Loading label="기록을 여는 중" />
      </SafeAreaView>
    );
  }

  if (entryQuery.isError) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ErrorText>
            {entryQuery.error instanceof ApiError ? entryQuery.error.message : '열지 못했어요.'}
          </ErrorText>
          <Button label="돌아가기" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const step = steps[index];
  const total = steps.length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (index > 0 ? goTo(index - 1) : router.back())}
          hitSlop={12}
          style={styles.headerButton}
        >
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>

        <View style={styles.progressArea}>
          <ProgressBar step={index + 1} total={total} />
          <Text style={styles.progressText}>
            {index + 1} / {total} · {formatYearMonth(entry.yearMonth)}
          </Text>
        </View>

        <Pressable onPress={() => router.replace('/(tabs)')} hitSlop={12} style={styles.headerButton}>
          <Text style={styles.headerClose}>닫기</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step.kind === 'line' ? (
          <LineStep
            key={step.line.id}
            entryId={entry.id}
            line={step.line}
            isIncome={step.line.kind === 'INCOME'}
            error={error}
            setError={setError}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
              goTo(index + 1);
            }}
          />
        ) : null}

        {step.kind === 'extras' ? (
          <ExtrasStep entry={entry} onNext={() => goTo(index + 1)} />
        ) : null}

        {step.kind === 'note' ? <NoteStep entry={entry} onNext={() => goTo(index + 1)} /> : null}

        {step.kind === 'review' ? (
          <ReviewStep
            entry={entry}
            onDone={(complete) => {
              void queryClient.invalidateQueries({ queryKey: ['book', familyId] });
              void queryClient.invalidateQueries({ queryKey: ['entry', entryId] });
              router.replace('/(tabs)');
              if (complete) router.push(`/summary/${entry.yearMonth}`);
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* 스텝 1..n — 수입 / 고정비                                            */
/* ------------------------------------------------------------------ */

function LineStep({
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
  const [amount, setAmount] = useState<number | null>(line.actualAmount ?? line.plannedAmount);
  const [reason, setReason] = useState(line.changeReason ?? '');

  const planned = line.plannedAmount;
  const changed = planned !== null && amount !== null && amount !== planned;
  const reasonNeeded = changed;

  const save = useMutation({
    mutationFn: () =>
      api(`/entries/${entryId}/lines/${line.id}`, {
        method: 'PATCH',
        body: { actualAmount: amount ?? 0, changeReason: reason.trim() || null },
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
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {!isIncome ? <Text style={styles.category}>{line.category}</Text> : null}

      <Text style={styles.question}>
        {isIncome ? '이번 달 수입은\n얼마나 들어왔나요?' : line.name}
      </Text>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        <AmountInput value={amount} onChange={setAmount} autoFocus />
        <DiffHint planned={planned} source={line.plannedSource} amount={amount} />
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

function DiffHint({
  planned,
  source,
  amount,
}: {
  planned: number | null;
  source: EntryLine['plannedSource'];
  amount: number | null;
}) {
  if (planned === null) {
    return <Muted>지난달 기록이 없어요. 이번 달 금액을 적어주세요.</Muted>;
  }

  const base = source === 'FIXED_DEFAULT' ? '등록한 금액' : '지난달';

  if (amount === null || amount === planned) {
    return <Text style={styles.hintSame}>{base}과 같아요 · {formatWon(planned)}</Text>;
  }

  const delta = amount - planned;
  return (
    <Text style={[styles.hintDiff, { color: delta > 0 ? colors.up : colors.down }]}>
      {base}보다 {formatAmount(Math.abs(delta))}원 {delta > 0 ? '많아요' : '적어요'}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* 스텝 n+1 — 추가 지출                                                 */
/* ------------------------------------------------------------------ */

function ExtrasStep({ entry, onNext }: { entry: Entry; onNext: () => void }) {
  const queryClient = useQueryClient();
  const extras = entry.lines.filter((l) => l.kind === 'EXTRA');

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('기타');
  const [amount, setAmount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['entry', entry.id] });

  const add = useMutation({
    mutationFn: () =>
      api(`/entries/${entry.id}/lines`, {
        method: 'POST',
        body: { name: name.trim(), category, actualAmount: amount ?? 0 },
      }),
    onSuccess: () => {
      setName('');
      setAmount(null);
      setCategory('기타');
      setAdding(false);
      setError(null);
      void refresh();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : '추가하지 못했어요.'),
  });

  const remove = useMutation({
    mutationFn: (lineId: string) =>
      api(`/entries/${entry.id}/lines/${lineId}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
  });

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.question}>이번 달에 추가로{'\n'}나간 돈이 있나요?</Text>
      <Muted>고정비에 없는, 이번 달에만 있었던 지출이에요.</Muted>

      <View style={{ gap: space.sm, marginTop: space.lg }}>
        {extras.map((line) => (
          <View key={line.id} style={styles.extraRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.extraName}>{line.name}</Text>
              <Text style={styles.extraMeta}>{line.category}</Text>
            </View>
            <Text style={styles.extraAmount}>{formatWon(line.actualAmount ?? 0)}</Text>
            <Pressable onPress={() => remove.mutate(line.id)} hitSlop={8}>
              <Text style={styles.removeIcon}>×</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {adding ? (
        <Card style={{ gap: space.lg, marginTop: space.md }}>
          <Field label="무엇에 쓴 돈인가요?" hint="이름이 곧 이유예요. 사유는 따로 묻지 않아요.">
            <Input value={name} onChangeText={setName} placeholder="형 결혼식 축의금" maxLength={30} autoFocus />
          </Field>

          <Field label="분류">
            <View style={styles.chips}>
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
            <AmountInput size="md" value={amount} onChange={setAmount} />
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

/* ------------------------------------------------------------------ */
/* 스텝 n+2 — 이번 달 특이사항                                          */
/* ------------------------------------------------------------------ */

function NoteStep({ entry, onNext }: { entry: Entry; onNext: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState(entry.note ?? '');

  const save = useMutation({
    mutationFn: () =>
      api(`/entries/${entry.id}`, { method: 'PATCH', body: { note: note.trim() || null } }),
    onSuccess: () => {
      // 다음이 확인 화면이다. 여기서 안 비우면 방금 적은 특이사항이 확인 화면에 안 보인다.
      void queryClient.invalidateQueries({ queryKey: ['entry', entry.id] });
      onNext();
    },
    onError: onNext, // 특이사항은 선택 입력이다. 저장에 실패해도 흐름을 막지 않는다.
  });

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.question}>이번 달,{'\n'}기억해둘 일이 있었나요?</Text>
      <Muted>없으면 건너뛰어도 괜찮아요.</Muted>

      <Input
        value={note}
        onChangeText={setNote}
        placeholder={'에어컨을 많이 틀어서 전기세가 올랐다.\n다음 달엔 좀 줄여보자.'}
        multiline
        maxLength={1000}
        style={{ marginTop: space.lg }}
      />

      <View style={{ gap: space.md, marginTop: space.xl }}>
        <Button label="다음" onPress={() => save.mutate()} loading={save.isPending} />
        <Button label="건너뛰기" variant="ghost" onPress={onNext} />
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* 스텝 n+3 — 확인 후 제출                                              */
/* ------------------------------------------------------------------ */

function ReviewStep({ entry, onDone }: { entry: Entry; onDone: (complete: boolean) => void }) {
  const [error, setError] = useState<string | null>(null);

  const changes = entry.lines.filter(
    (line) => line.changeReason && line.plannedAmount !== null && line.actualAmount !== null,
  );

  const submit = useMutation({
    mutationFn: () =>
      api<{ bookStatus: 'OPEN' | 'COMPLETE' }>(`/entries/${entry.id}/submit`, { method: 'POST' }),
    onSuccess: (result) => onDone(result.bookStatus === 'COMPLETE'),
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '제출하지 못했어요.'),
  });

  const { income, fixedTotal, extraTotal, surplus } = entry.summary;

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <Text style={styles.question}>이렇게 적을게요</Text>

      <Card style={{ gap: space.md, marginTop: space.lg }}>
        <Row label="수입" value={formatWon(income)} />
        <Row label="고정비" value={`− ${formatWon(fixedTotal)}`} />
        <Row label="추가 지출" value={`− ${formatWon(extraTotal)}`} />
        <Divider />
        <Row label="남은 돈" value={formatWon(surplus)} strong tone={surplus < 0 ? 'up' : 'down'} />
      </Card>

      {changes.length > 0 ? (
        <Card style={{ gap: space.md, marginTop: space.lg }}>
          <Text style={styles.cardTitle}>이번 달 달라진 것 {changes.length}개</Text>
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
          <Text style={styles.cardTitle}>이번 달 특이사항</Text>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  headerButton: { minWidth: 36, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 30, color: colors.inkSoft, lineHeight: 34 },
  headerClose: { ...font.small, color: colors.inkFaint, fontWeight: '700' },
  progressArea: { flex: 1, gap: space.xs },
  progressText: { ...font.caption, color: colors.inkFaint, textAlign: 'center' },

  body: { padding: space.xl, paddingBottom: space.xxl * 2 },

  category: {
    ...font.small,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: space.xs,
  },
  question: { ...font.question, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },

  hintSame: { ...font.small, color: colors.inkFaint, textAlign: 'right' },
  hintDiff: { ...font.small, fontWeight: '700', textAlign: 'right' },

  reasonCard: { marginTop: space.lg, backgroundColor: colors.upSoft, borderColor: colors.upSoft },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  extraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  extraName: { ...font.body, color: colors.ink, fontWeight: '600' },
  extraMeta: { ...font.caption, color: colors.inkFaint },
  extraAmount: { ...font.body, color: colors.ink, fontWeight: '700', fontVariant: ['tabular-nums'] },
  removeIcon: { fontSize: 24, color: colors.inkFaint, lineHeight: 26 },

  cardTitle: { ...font.body, fontWeight: '700', color: colors.ink },
  changeHead: { flexDirection: 'row', justifyContent: 'space-between' },
  changeName: { ...font.body, color: colors.ink, fontWeight: '600' },
  changeDelta: { ...font.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
  changeReason: { ...font.small, color: colors.inkSoft },
  noteText: { ...font.body, color: colors.inkSoft },
});
