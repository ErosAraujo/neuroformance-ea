import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors, translucentForStatus } from '../theme';

export type MetricCardProps = {
  title: string;
  emoji: string;
  value?: number | null;
  classification?: string | null;
  color: string;
  negative?: boolean;
  wide?: boolean;
  selected?: boolean;
  valueSuffix?: '%' | '/100';
  onPress?: () => void;
};

export default function MetricCard({ title, emoji, value, classification, color, negative = false, wide = false, selected = false, valueSuffix = '/100', onPress }: MetricCardProps) {
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const roundedValue = hasValue ? String(Math.round(Math.max(0, Math.min(100, value)))) : '--';
  const classificationText = classification || '--';
  const valueText = valueSuffix === '%' && hasValue ? `${roundedValue}%` : roundedValue;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        wide && styles.wide,
        selected && { borderColor: color, backgroundColor: 'rgba(255,255,255,0.095)' },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.iconBubble, { backgroundColor: translucentForStatus(classification, negative) }]}> 
        <Text style={styles.emoji}>{emoji}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{valueText}</Text>
        {valueSuffix === '/100' && <Text style={styles.total}>/100</Text>}
      </View>
      <Text style={[styles.classification, { color }]}>{classificationText}</Text>
      <Text style={styles.tapHint}>{selected ? 'Toque para fechar' : 'Toque para ver detalhes'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    minHeight: 158,
    backgroundColor: 'rgba(8,13,30,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 14,
    marginBottom: 12,
  },
  wide: {
    width: '100%',
  },
  pressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.9,
  },
  iconBubble: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emoji: {
    fontSize: 23,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    minHeight: 34,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  total: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
    marginLeft: 2,
  },
  classification: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  tapHint: {
    color: colors.subtle,
    fontSize: 10,
    marginTop: 8,
    fontWeight: '700',
  },
});
