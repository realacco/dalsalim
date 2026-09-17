import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CATEGORIES } from '@/shared/model/types';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import {
  AmountInput,
  Button,
  Chip,
  ErrorText,
  Field,
  Input,
  Notice,
  Sheet,
  Toggle,
} from '@/shared/ui';
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
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const isOpen = draft !== null;

  /**
   * 시스템 내비게이션 영역 **위에** 여유를 얹는다. 탭 바(`widgets/tab-bar`)와 **같은 모양**이되
   * 최소값이 다르다 — 탭 바는 `lg`, 여기는 `xl`. 같은 계산이라고 읽고 한쪽만 고치면 안 된다.
   *
   * 탭 바가 있는 화면은 탭 바 높이가 이 자리를 대신 비워준다. 시트에는 그게 없어서
   * [닫기] 가 제스처 바·3버튼 바에 그대로 깔린다 — 투명해서 가려지진 않지만 겹쳐서 안 읽힌다.
   * 인셋이 0으로 오는 기기가 있어 지금까지 쓰던 xl 을 최소값으로 남긴다.
   */
  const bottom = Math.max(insets.bottom + space.md, space.xl);

  return (
    // 배경을 눌러 닫지 않는다 — 적던 칸이 헛손질 한 번에 날아간다
    <Sheet
      visible={isOpen}
      onClose={onClose}
      title={draft?.id ? '고정비 수정' : '고정비 추가'}
      dismissOnBackdrop={false}
      capHeight
    >
      {/*
        패딩은 ScrollView 가 아니라 contentContainerStyle 에 준다.
        시트에 패딩을 주면 ScrollView 가 그만큼 안쪽에 놓여서
        스크롤바가 화면 끝이 아니라 글자 위에 그려진다.
      */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.sheetContent, { paddingBottom: bottom }]}
      >
        {/*
          '생활비' 를 여기 넣는 사람이 있는데, 뜻이 두 가지다. (기획서 3장)
          매달 이체하는 정액이면 고정비가 맞지만, 실제로 쓴 총액이면 매달 금액이 달라서
          위저드가 매번 사유를 묻는다 — 사유가 "예외 기록"이 아니라 "매달 잔업"이 된다.
          등록하기 전에 갈라줘야 한다.
        */}
        <Notice>
          매달 <Text style={styles.noticeStrong}>같은 금액</Text>이 나가는 것만 등록해요. 생활비도
          매달 옮겨두는 정액이면 여기 맞고, 실제로 쓴 돈은 기록할 때 적어요.
        </Notice>

        <Field label="항목 이름" hint="예: 통신비, 월세, 자동차보험">
          <Input
            value={draft?.name ?? ''}
            onChangeText={(name) => onChange({ name })}
            placeholder="통신비"
            maxLength={30}
          />
        </Field>

        {/*
          이름 바로 다음에 둔다. "무엇인가"를 적는 두 칸이 붙어 있어야 흐름이 안 끊긴다.
          ⚠️ 여러 줄로 열지 않는다 — 목록 행 높이가 항목마다 달라지고,
          엔터로 칸이 끝없이 늘어나는 문제를 여기서 다시 만든다.
        */}
        <Field label="설명 (선택)" hint="목록에서 가족이 볼 때 도움이 돼요.">
          <Input
            value={draft?.description ?? ''}
            onChangeText={(description) => onChange({ description })}
            placeholder="아빠 휴대폰 · 5G"
            maxLength={60}
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
            calculator
            value={draft?.defaultAmount ?? null}
            onChange={(defaultAmount) => onChange({ defaultAmount })}
          />
        </Field>

        <Field label="출금일 (선택)" hint="1~31 사이 숫자">
          <Input
            value={draft?.dayOfMonth ?? ''}
            onChangeText={(text) => onChange({ dayOfMonth: sanitizeDay(text) })}
            placeholder="25"
            keyboardType="number-pad"
          />
        </Field>

        {/*
          결산 스위치 (F-FIX-07). 분류를 생활비로 고르면 켜지고, 사람이 건드리기 전까지만 따라간다 —
          그 규칙은 model/draft 의 patchDraft 에 있다. "목표" "예산" 이라는 말을 쓰지 않는다 (하드룰 9).
        */}
        <Toggle
          label="다음 달에 실제로 쓴 금액을 물어요"
          hint="생활비처럼 옮겨두고 쓰는 돈에 켜두세요. 통신비처럼 그냥 빠져나가는 돈은 꺼두면 돼요."
          value={draft?.settles ?? false}
          onValueChange={(settles) => onChange({ settles })}
        />

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
    </Sheet>
  );
}

const useStyles = makeStyles((t) => ({
  sheetContent: {
    paddingHorizontal: t.space.xl,
    gap: t.space.lg,
  },
  noticeStrong: { fontWeight: t.weight.bold, color: t.colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
}));
