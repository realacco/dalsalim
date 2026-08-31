import { ReactNode } from 'react';
import { Text } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';

export function SectionTitle({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  const styles = useStyles();
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const styles = useStyles();
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const useStyles = makeStyles((t) => ({
  sectionTitle: {
    ...t.font.small,
    color: t.colors.inkFaint,
    fontWeight: t.weight.bold,
    letterSpacing: 0.4,
    marginBottom: t.space.sm,
  },
  muted: { ...t.font.small, color: t.colors.inkFaint, lineHeight: 20 },
  error: { ...t.font.small, color: t.colors.danger, lineHeight: 20 },
}));
