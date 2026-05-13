import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { WeeklyStatusPoint } from '../utils/historicalIndicators';

function dayLabel(dateValue: string, index: number, lastIndex: number) {
  if (index === lastIndex) return 'Hoje';
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(dateValue).slice(5, 10);
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return labels[date.getDay()] || String(dateValue).slice(5, 10);
}

type Props = {
  points: WeeklyStatusPoint[];
};

export default function WeeklyChart({ points }: Props) {
  const ordered = [...points]
    .filter((point) => typeof point.value === 'number' && Number.isFinite(point.value))
    .sort((a, b) => new Date(`${a.date}T12:00:00`).getTime() - new Date(`${b.date}T12:00:00`).getTime())
    .slice(-7);

  if (!ordered.length) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>Registre mais noites para completar o gráfico semanal.</Text>
      </View>
    );
  }

  return (
    <View style={styles.chartCard}>
      <View style={styles.gridLineTop} />
      <View style={styles.gridLineMiddle} />
      <View style={styles.barsRow}>
        {ordered.map((point, index) => {
          const isLast = index === ordered.length - 1;
          const score = Math.max(0, Math.min(100, Number(point.value) || 0));
          const barHeight = Math.max(14, Math.round(score * 1.2));
          const barColor = isLast ? colors.success : colors.primary;
          return (
            <View style={styles.barColumn} key={`${point.date}-${index}`}>
              <Text style={[styles.barValue, isLast && { color: colors.success }]}>{Math.round(score)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { height: barHeight, backgroundColor: barColor, shadowColor: barColor }]} />
              </View>
              <Text style={styles.barLabel}>{dayLabel(point.date, index, ordered.length - 1)}</Text>
            </View>
          );
        })}
      </View>
      {ordered.length < 7 && <Text style={styles.partialText}>Registre mais noites para completar o gráfico semanal.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  chartCard: {
    minHeight: 206,
    backgroundColor: 'rgba(8,13,30,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  barsRow: {
    minHeight: 156,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  barValue: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  barTrack: {
    height: 122,
    width: '100%',
    maxWidth: 28,
    justifyContent: 'flex-end',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 12,
  },
  barLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
    fontWeight: '700',
  },
  partialText: {
    color: colors.subtle,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },
  gridLineTop: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 44,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  gridLineMiddle: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 104,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  emptyCard: {
    backgroundColor: 'rgba(8,13,30,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.muted,
    lineHeight: 19,
  },
});
