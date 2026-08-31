import { Text } from 'react-native';

import { makeStyles } from '@/shared/config/theme-provider';
import { PressableScale } from './pressable-scale';

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <PressableScale
      small
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </PressableScale>
  );
}

const useStyles = makeStyles((t) => ({
  chip: {
    paddingHorizontal: t.space.lg,
    paddingVertical: t.space.sm + 2,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.line,
    backgroundColor: t.colors.surface,
  },
  chipSelected: { backgroundColor: t.colors.primarySoft, borderColor: t.colors.primary },
  label: { ...t.font.small, color: t.colors.inkSoft, fontWeight: t.weight.semibold },
  labelSelected: { color: t.colors.primary, fontWeight: t.weight.bold },
}));
