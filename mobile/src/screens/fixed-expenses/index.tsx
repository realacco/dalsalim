import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import { CATEGORIES, type Category } from '@/shared/model/types';
import {
  createFixedExpense,
  deleteFixedExpense,
  fetchFixedExpenses,
  fixedExpenseKeys,
  updateFixedExpense,
} from '@/entities/fixed-expense';
import { bookKeys } from '@/entities/book';
import { useSession } from '@/entities/session';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
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
  Notice,
} from '@/shared/ui';
import { formatWon } from '@/shared/lib/format';

type Draft = {
  id: string | null;
  membershipId: string;
  name: string;
  category: Category;
  defaultAmount: number | null;
  dayOfMonth: string;
};

export default function FixedScreen() {
  const styles = useStyles();
  const { space } = useTheme();
  const queryClient = useQueryClient();
  const familyId = useSession((state) => state.familyId);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useQuery({
    queryKey: fixedExpenseKeys.list(familyId),
    queryFn: () => fetchFixedExpenses(familyId as string),
    enabled: Boolean(familyId),
  });

  const save = useMutation({
    mutationFn: async (value: Draft) => {
      const body = {
        name: value.name.trim(),
        category: value.category,
        defaultAmount: value.defaultAmount ?? 0,
        dayOfMonth: value.dayOfMonth ? Number(value.dayOfMonth) : null,
      };

      if (value.id) {
        return updateFixedExpense(value.id, body);
      }
      return createFixedExpense(familyId as string, {
        ...body,
        membershipId: value.membershipId,
      });
    },
    onSuccess: () => {
      setDraft(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: fixedExpenseKeys.list(familyId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
    },
    onError: (caught) =>
      setError(caught instanceof ApiError ? caught.message : '저장하지 못했어요.'),
  });

  const remove = useMutation({
    mutationFn: deleteFixedExpense,
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: fixedExpenseKeys.list(familyId) });
      void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
    },
  });

  const total = groups.data?.groups.reduce((sum, group) => sum + group.monthlyTotal, 0) ?? 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>고정비</Text>
        <Muted>매달 나가는 돈을 사람별로 등록해두면, 기록할 때 자동으로 물어봐요.</Muted>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={groups.isFetching} onRefresh={() => void groups.refetch()} />
        }
      >
        {groups.isLoading ? <Loading /> : null}

        {groups.data ? (
          <Card style={styles.totalCard}>
            <Text style={styles.totalLabel}>우리 가족 고정비 합계</Text>
            <Text style={styles.totalValue}>{formatWon(total)}</Text>
            <Muted>매달 이만큼은 이미 나갈 예정이에요.</Muted>
          </Card>
        ) : null}

        {groups.data?.groups.map((group) => (
          <Card key={group.membershipId} style={{ gap: space.md }}>
            <View style={styles.groupHead}>
              <Text style={styles.groupName}>
                {group.displayName}
                {group.isMe ? ' (나)' : ''}
              </Text>
              <Text style={styles.groupTotal}>{formatWon(group.monthlyTotal)}</Text>
            </View>

            <Divider />

            {group.items.length === 0 ? (
              <Muted>아직 등록한 고정비가 없어요.</Muted>
            ) : (
              group.items.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    setDraft({
                      id: item.id,
                      membershipId: group.membershipId,
                      name: item.name,
                      category: item.category as Category,
                      defaultAmount: item.defaultAmount,
                      dayOfMonth: item.dayOfMonth ? String(item.dayOfMonth) : '',
                    })
                  }
                  style={styles.item}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>
                      {item.category}
                      {item.dayOfMonth ? ` · 매월 ${item.dayOfMonth}일` : ''}
                    </Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatWon(item.defaultAmount)}</Text>
                </Pressable>
              ))
            )}

            <Button
              label="+ 항목 추가"
              variant="ghost"
              onPress={() =>
                setDraft({
                  id: null,
                  membershipId: group.membershipId,
                  name: '',
                  category: '주거',
                  defaultAmount: null,
                  dayOfMonth: '',
                })
              }
            />
          </Card>
        ))}
      </ScrollView>

      <Modal visible={draft !== null} animationType="slide" transparent onRequestClose={() => setDraft(null)}>
        {/*
          키보드를 피하는 건 시트가 아니라 **화면 전체**여야 한다.
          시트만 감싸면 줄어들 여지가 없어서 [저장] 이 키보드에 그대로 덮인다.
          바깥 컨테이너를 줄여야 아래 정렬된 시트가 키보드 위로 올라온다. (에뮬레이터에서 확인)
        */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {
            <View style={styles.sheet}>
              {/* 시트를 아래로 끌어내릴 수 있다는 표시이자, 여기가 스크롤된다는 신호 */}
              <View style={styles.grabber} />
              {/*
                패딩은 ScrollView 가 아니라 contentContainerStyle 에 준다.
                시트에 패딩을 주면 ScrollView 가 그만큼 안쪽에 놓여서
                스크롤바가 화면 끝이 아니라 글자 위에 그려진다.
              */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetContent}
              >
                <Text style={styles.sheetTitle}>
                  {draft?.id ? '고정비 수정' : '고정비 추가'}
                </Text>

                {/*
                  '생활비' 를 여기 넣는 사람이 있는데, 뜻이 두 가지다. (기획서 3장)
                  매달 이체하는 정액이면 고정비가 맞지만, 실제로 쓴 총액이면 매달 금액이 달라서
                  위저드가 매번 사유를 묻는다 — 사유가 "예외 기록"이 아니라 "매달 잔업"이 된다.
                  등록하기 전에 갈라줘야 한다.
                */}
                <Notice>
                  매달 <Text style={styles.noticeStrong}>같은 금액</Text>이 나가는 것만 등록해요.
                  생활비도 매달 옮겨두는 정액이면 여기 맞고, 실제로 쓴 돈은 기록할 때 적어요.
                </Notice>

                <Field label="항목 이름" hint="예: 통신비, 월세, 자동차보험">
                  <Input
                    value={draft?.name ?? ''}
                    onChangeText={(text) => setDraft((prev) => (prev ? { ...prev, name: text } : prev))}
                    placeholder="통신비"
                    maxLength={30}
                  />
                </Field>

                <Field label="분류">
                  <View style={styles.chips}>
                    {CATEGORIES.map((category) => (
                      <Chip
                        key={category}
                        label={category}
                        selected={draft?.category === category}
                        onPress={() => setDraft((prev) => (prev ? { ...prev, category } : prev))}
                      />
                    ))}
                  </View>
                </Field>

                <Field label="기본 금액" hint="매달 기록할 때 이 금액이 먼저 채워져요.">
                  <AmountInput
                    size="md"
                    value={draft?.defaultAmount ?? null}
                    onChange={(next) =>
                      setDraft((prev) => (prev ? { ...prev, defaultAmount: next } : prev))
                    }
                  />
                </Field>

                <Field label="결제일 (선택)" hint="1~31 사이 숫자">
                  <Input
                    value={draft?.dayOfMonth ?? ''}
                    onChangeText={(text) =>
                      setDraft((prev) =>
                        prev ? { ...prev, dayOfMonth: text.replace(/[^0-9]/g, '').slice(0, 2) } : prev,
                      )
                    }
                    placeholder="25"
                    keyboardType="number-pad"
                  />
                </Field>

                <ErrorText>{error}</ErrorText>

                <Button
                  label="저장"
                  onPress={() => {
                    if (!draft) return;
                    if (!draft.name.trim()) {
                      setError('항목 이름을 적어주세요.');
                      return;
                    }
                    const day = draft.dayOfMonth ? Number(draft.dayOfMonth) : null;
                    if (day !== null && (day < 1 || day > 31)) {
                      setError('결제일은 1에서 31 사이여야 해요.');
                      return;
                    }
                    save.mutate(draft);
                  }}
                  loading={save.isPending}
                />

                {draft?.id ? (
                  <Button
                    label="이 항목 지우기"
                    variant="ghost"
                    onPress={() =>
                      Alert.alert(
                        '고정비 지우기',
                        '앞으로의 기록에서 빠져요. 지난 기록은 그대로 남습니다.',
                        [
                          { text: '취소', style: 'cancel' },
                          {
                            text: '지우기',
                            style: 'destructive',
                            onPress: () => draft.id && remove.mutate(draft.id),
                          },
                        ],
                      )
                    }
                  />
                ) : null}

                <Button label="닫기" variant="ghost" onPress={() => setDraft(null)} />
              </ScrollView>
            </View>
          }
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.bg },
  header: { paddingHorizontal: t.space.lg, paddingTop: t.space.md, paddingBottom: t.space.sm, gap: t.space.xs },
  title: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink },
  content: { padding: t.space.lg, paddingTop: t.space.sm, gap: t.space.lg, paddingBottom: t.space.xxl },

  totalCard: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primarySoft, gap: t.space.xs },
  totalLabel: { ...t.font.small, color: t.colors.primary, fontWeight: t.weight.bold },
  totalValue: { ...t.font.question, fontWeight: t.weight.heavy, color: t.colors.ink },

  groupHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  groupName: { ...t.font.bodyLg, fontWeight: t.weight.bold, color: t.colors.ink },
  groupTotal: { ...t.font.body, color: t.colors.inkSoft, fontVariant: ['tabular-nums' as const] },

  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: t.space.sm, gap: t.space.md },
  itemName: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.semibold },
  itemMeta: { ...t.font.caption, color: t.colors.inkFaint },
  itemAmount: { ...t.font.body, color: t.colors.ink, fontWeight: t.weight.bold, fontVariant: ['tabular-nums' as const] },

  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    paddingTop: t.space.md,
    maxHeight: '90%',
    ...t.shadow.sheet,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
    marginBottom: t.space.md,
  },
  sheetContent: {
    paddingHorizontal: t.space.xl,
    paddingBottom: t.space.xl,
    gap: t.space.lg,
  },
  sheetTitle: { ...t.font.title, fontWeight: t.weight.heavy, color: t.colors.ink },
  noticeStrong: { fontWeight: t.weight.bold, color: t.colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
}));
