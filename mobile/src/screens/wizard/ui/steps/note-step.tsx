import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type Entry, entryKeys, patchEntry } from '@/entities/entry';
import { makeStyles, useTheme } from '@/shared/config/theme-provider';
import { Button, Input, Muted } from '@/shared/ui';
import { useStepStyles } from '../styles';

/**
 * 스텝 n+2 — 이번 달 특이사항. 선택 입력이다.
 * 몇 달 뒤 "그때 왜 그랬더라"에 답해주는 재료라서, 짧아도 적어두는 쪽이 낫다.
 */
export function NoteStep({ entry, onNext }: { entry: Entry; onNext: () => void }) {
  const stepStyles = useStepStyles();
  const { space } = useTheme();
  const queryClient = useQueryClient();
  const [note, setNote] = useState(entry.note ?? '');

  const save = useMutation({
    mutationFn: () => patchEntry(entry.id, { note: note.trim() || null }),
    onSuccess: () => {
      // 다음이 확인 화면이다. 여기서 안 비우면 방금 적은 특이사항이 확인 화면에 안 보인다.
      void queryClient.invalidateQueries({ queryKey: entryKeys.detail(entry.id) });
      onNext();
    },
    onError: onNext, // 특이사항은 선택 입력이다. 저장에 실패해도 흐름을 막지 않는다.
  });

  return (
    <ScrollView contentContainerStyle={stepStyles.body} keyboardShouldPersistTaps="handled">
      <Text style={stepStyles.question}>이번 달,{'\n'}기억해둘 일이 있었나요?</Text>
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
