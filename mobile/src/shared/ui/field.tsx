import { ReactNode, useState } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

import { makeStyles, useTheme } from '@/shared/config/theme-provider';

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
  fieldHint: { ...t.font.caption, color: t.colors.inkFaint, lineHeight: 18 },
  input: {
    backgroundColor: t.colors.surface,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    borderRadius: t.radius.lg,
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.md + 2,
    ...t.font.bodyLg,
    color: t.colors.ink,
  },
  inputFocused: { borderColor: t.colors.primary },
  inputMultiline: { minHeight: 132, textAlignVertical: 'top', paddingTop: t.space.md },
}));
