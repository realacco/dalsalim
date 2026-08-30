import { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, font, space } from '@/shared/config/theme';

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...font.small,
    color: colors.inkFaint,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: space.sm,
  },
  muted: { ...font.small, color: colors.inkFaint },
  error: { ...font.small, color: colors.danger },
});
