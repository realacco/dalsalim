import { ReactNode, useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';

/**
 * 여러 줄 칸의 높이. 팔레트가 아니라 이 컴포넌트의 치수다 (`Button` 의 높이와 같은 종류).
 *
 * 최소는 "여러 줄 적어도 된다"는 신호이고, **최대는 뚜껑**이다 — 없으면 엔터를 칠 때마다
 * 칸이 끝없이 늘어나 아래 버튼을 화면 밖으로 밀어낸다. 넘으면 칸 안에서 스크롤된다.
 */
const MULTILINE_MIN_HEIGHT = 132;
const MULTILINE_MAX_HEIGHT = 240;

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const { space } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

export function Input(props: TextInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={colors.inkFaint}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        // 지금 어디를 적고 있는지 테두리로 보여준다
        focused && styles.inputFocused,
        props.multiline && styles.inputMultiline,
        props.style,
      ]}
    />
  );
}

const useStyles = makeStyles((t) => ({
  fieldLabel: { ...t.font.small, color: t.colors.inkSoft, fontWeight: t.weight.bold },
  fieldHint: { ...t.font.hint, color: t.colors.inkFaint },
  input: {
    backgroundColor: t.colors.surface,
    borderWidth: t.border.control,
    borderColor: t.colors.line,
    borderRadius: t.radius.lg,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md + t.space.xxs,
    ...t.font.bodyLg,
    color: t.colors.ink,
  },
  inputFocused: { borderColor: t.colors.primary },
  inputMultiline: {
    minHeight: MULTILINE_MIN_HEIGHT,
    maxHeight: MULTILINE_MAX_HEIGHT,
    textAlignVertical: 'top',
    paddingTop: t.space.md,
  },
}));
