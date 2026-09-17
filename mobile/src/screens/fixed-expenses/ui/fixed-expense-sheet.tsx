import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
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
  Toggle,
  useSheetDrag,
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

  /*
    끌어내려 닫는 배관은 `shared/ui/use-sheet-drag` 에 있다. 세 시트가 같은 것을 복사해 쓰던 것을
    거기로 올렸다 — 이 파일이 먼저 겪은 함정들(모달 안 제스처 뿌리 · 다음 프레임 닫기 ·
    드라이버 끄기)의 근거 주석도 같이 옮겼다.
  */
  const { translateY, drag } = useSheetDrag(isOpen, onClose);

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
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      {/*
        ⚠️ gesture-handler 는 RN `Modal` 안에서 그냥은 안 돈다. Modal 은 별도의 네이티브 창이라
        앱 루트의 제스처 트리 밖에 있어서, **이 안에 뿌리를 한 번 더 심어야** 한다.
      */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        {/*
          키보드를 피하는 건 시트가 아니라 **화면 전체**여야 한다.
          시트만 감싸면 줄어들 여지가 없어서 [저장] 이 키보드에 그대로 덮인다.
          바깥 컨테이너를 줄여야 아래 정렬된 시트가 키보드 위로 올라온다. (에뮬레이터에서 확인)
        */}
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            {/*
              잡는 영역은 알약(40x4)이 아니라 **제목까지 포함한 머리 전체**다.
              4dp 짜리를 정확히 짚으라고 할 수 없다 — 원래 후기도 "서랍 형태" 였다.
              제스처를 여기에만 걸어야 안쪽 목록 스크롤과 안 싸운다.
            */}
            <GestureDetector gesture={drag}>
              <View style={styles.header}>
                <View style={styles.grabber} />
                <Text style={styles.sheetTitle}>{draft?.id ? '고정비 수정' : '고정비 추가'}</Text>
              </View>
            </GestureDetector>
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
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const useStyles = makeStyles((t) => ({
  gestureRoot: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.bg,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    maxHeight: '90%',
    ...t.shadow.sheet,
  },
  /** 알약과 제목을 함께 담는 **잡는 영역**. 이 띠 전체가 손잡이다 */
  header: { paddingTop: t.space.lg, paddingBottom: t.space.md, gap: t.space.md },
  grabber: {
    alignSelf: 'center',
    width: t.size.grabberWidth,
    height: t.size.grabberHeight,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.lineStrong,
  },
  sheetContent: {
    paddingHorizontal: t.space.xl,
    gap: t.space.lg,
  },
  sheetTitle: {
    ...t.font.title,
    fontWeight: t.weight.heavy,
    color: t.colors.ink,
    paddingHorizontal: t.space.xl,
  },
  noticeStrong: { fontWeight: t.weight.bold, color: t.colors.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space.sm },
}));
