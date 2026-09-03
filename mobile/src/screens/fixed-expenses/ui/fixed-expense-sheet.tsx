import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';

import { CATEGORIES } from '@/shared/model/types';
import { makeStyles } from '@/shared/config/theme-provider';
import { AmountInput, Button, Chip, ErrorText, Field, Input, Notice } from '@/shared/ui';
import { confirm } from '@/shared/lib/confirm';

import { type Draft, sanitizeDay } from '../model/draft';

/** 고정비 하나를 추가·수정하는 아래 시트. draft 가 없으면 닫혀 있다. */
export function FixedExpenseSheet({
  draft,
  error,
  saving,
  onChange,
  onSave,
  onRemove,
  onClose,
}: {
  draft: Draft | null;
  error: string | null;
  saving: boolean;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();

  return (
    <Modal visible={draft !== null} animationType="slide" transparent onRequestClose={onClose}>
      {/*
        키보드를 피하는 건 시트가 아니라 **화면 전체**여야 한다.
        시트만 감싸면 줄어들 여지가 없어서 [저장] 이 키보드에 그대로 덮인다.
        바깥 컨테이너를 줄여야 아래 정렬된 시트가 키보드 위로 올라온다. (에뮬레이터에서 확인)
      */}
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
            <Text style={styles.sheetTitle}>{draft?.id ? '고정비 수정' : '고정비 추가'}</Text>

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
                onChangeText={(name) => onChange({ name })}
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
                    onPress={() => onChange({ category })}
                  />
                ))}
              </View>
            </Field>

            <Field label="기본 금액" hint="매달 기록할 때 이 금액이 먼저 채워져요.">
              <AmountInput
                size="md"
                value={draft?.defaultAmount ?? null}
                onChange={(defaultAmount) => onChange({ defaultAmount })}
              />
            </Field>

            <Field label="결제일 (선택)" hint="1~31 사이 숫자">
              <Input
                value={draft?.dayOfMonth ?? ''}
                onChangeText={(text) => onChange({ dayOfMonth: sanitizeDay(text) })}
                placeholder="25"
                keyboardType="number-pad"
              />
            </Field>

            <ErrorText>{error}</ErrorText>

            <Button label="저장" onPress={onSave} loading={saving} />

            {draft?.id ? (
              <Button
                label="이 항목 지우기"
                variant="ghost"
                onPress={() =>
                  confirm({
                    title: '고정비 지우기',
                    body: '앞으로의 기록에서 빠져요. 지난 기록은 그대로 남아요.',
                    confirmLabel: '지우기',
                    destructive: true,
                    onConfirm: onRemove,
                  })
                }
              />
            ) : null}

            <Button label="닫기" variant="ghost" onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
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
