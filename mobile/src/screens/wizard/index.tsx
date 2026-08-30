import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/shared/api/client';
import { bookKeys } from '@/entities/book';
import { entryKeys } from '@/entities/entry';
import { useSession } from '@/entities/session';
import { colors, font, space } from '@/shared/config/theme';
import { Button, ErrorText, Loading, ProgressBar } from '@/shared/ui';
import { formatYearMonth } from '@/shared/lib/format';

import { useWizard } from './model/use-wizard';
import { ExtrasStep } from './ui/steps/extras-step';
import { LineStep } from './ui/steps/line-step';
import { NoteStep } from './ui/steps/note-step';
import { ReviewStep } from './ui/steps/review-step';

/**
 * 스텝 입력 위저드 — 이 앱의 심장.
 *
 * 한 화면에 질문 하나. 기본값은 서버가 지난달 기록으로 채워서 내려준다.
 * 이 파일은 껍데기만 맡는다 — 헤더·진행바·스텝 전환. 흐름은 useWizard, 내용은 각 스텝 파일에 있다.
 */
export default function WizardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const familyId = useSession((state) => state.familyId);
  const { entryId } = useLocalSearchParams<{ entryId: string }>();

  const [error, setError] = useState<string | null>(null);
  const { entry, steps, index, goTo, isLoading, isError, error: loadError } = useWizard(entryId);

  function move(next: number) {
    setError(null);
    goTo(next);
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centered}>
          <ErrorText>
            {loadError instanceof ApiError ? loadError.message : '열지 못했어요.'}
          </ErrorText>
          <Button label="돌아가기" variant="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading || !entry || index === null) {
    return (
      <SafeAreaView style={styles.screen}>
        <Loading label="기록을 여는 중" />
      </SafeAreaView>
    );
  }

  const step = steps[index];
  const total = steps.length;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (index > 0 ? move(index - 1) : router.back())}
          hitSlop={12}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="이전"
        >
          <Text style={styles.headerIcon}>‹</Text>
        </Pressable>

        <View style={styles.progressArea}>
          <ProgressBar step={index + 1} total={total} />
          <Text style={styles.progressText}>
            {index + 1} / {total} · {formatYearMonth(entry.yearMonth)}
          </Text>
        </View>

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          hitSlop={12}
          style={styles.headerButton}
          accessibilityRole="button"
        >
          <Text style={styles.headerClose}>닫기</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {step?.kind === 'line' ? (
          <LineStep
            key={step.line.id}
            entryId={entry.id}
            line={step.line}
            isIncome={step.line.kind === 'INCOME'}
            error={error}
            setError={setError}
            onSaved={() => {
              void queryClient.invalidateQueries({ queryKey: entryKeys.detail(entry.id) });
              move(index + 1);
            }}
          />
        ) : null}

        {step?.kind === 'extras' ? (
          <ExtrasStep entry={entry} onNext={() => move(index + 1)} />
        ) : null}

        {step?.kind === 'note' ? <NoteStep entry={entry} onNext={() => move(index + 1)} /> : null}

        {step?.kind === 'review' ? (
          <ReviewStep
            entry={entry}
            onDone={(complete) => {
              void queryClient.invalidateQueries({ queryKey: bookKeys.family(familyId) });
              void queryClient.invalidateQueries({ queryKey: entryKeys.detail(entry.id) });
              router.replace('/(tabs)');
              if (complete) router.push(`/summary/${entry.yearMonth}`);
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },

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
});
