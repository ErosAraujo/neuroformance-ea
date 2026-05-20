import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api, { getApiErrorMessage } from '../services/api';
import { SleepRecord } from '../types';
import { colors, scoreColor, shared } from '../theme';
import { buildHistoricalIndicatorPoints } from '../utils/historicalIndicators';

type FilterMode = '7' | '30' | 'custom' | 'all';
type HistoryPointMap = Record<string, number | null>;

const dateKey = (value: unknown) => String(value || '').slice(0, 10);
const validNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const formatHours = (value?: number | null) => validNumber(value) ? `${Number(value).toFixed(1)}h` : 'Sem dados';
const formatScale = (value?: number | null) => validNumber(value) ? `${value}/5` : 'Sem dados';
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('7');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const showDateError = (value: string) => value.length >= 10 && !validDate(value);

  const buildQuery = useCallback((validateCustom = false) => {
    if (filter === '7' || filter === '30') return `?days=${filter}`;
    if (filter !== 'custom') return '';
    if (!validateCustom) return null;
    if (start && !validDate(start)) {
      Alert.alert('Data inválida', 'Revise a data inicial no formato AAAA-MM-DD.');
      return null;
    }
    if (end && !validDate(end)) {
      Alert.alert('Data inválida', 'Revise a data final no formato AAAA-MM-DD.');
      return null;
    }
    if (start && end && new Date(start) > new Date(end)) {
      Alert.alert('Período inválido', 'A data inicial não pode ser maior que a data final.');
      return null;
    }
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filter, start, end]);

  const fetchRecords = useCallback(async (validateCustom = false) => {
    const query = buildQuery(validateCustom);
    if (query === null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get(`/sleep-records${query}`);
      const list = Array.isArray(response.data) ? [...response.data] : [];
      setRecords(list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível carregar o histórico.'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useFocusEffect(useCallback(() => { if (filter !== 'custom') fetchRecords(false); }, [filter, fetchRecords]));

  const handleFilterChange = (nextFilter: FilterMode) => {
    setFilter(nextFilter);
    setLoadError(null);
    if (nextFilter === 'custom') setLoading(false);
  };

  const statusByDate = useMemo<HistoryPointMap>(() => {
    const ordered = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const points = buildHistoricalIndicatorPoints(ordered);
    return points.reduce<HistoryPointMap>((acc, point) => {
      acc[dateKey(point.date)] = point.statusGeneral;
      return acc;
    }, {});
  }, [records]);

  const renderHeader = () => (
    <View>
      <Text style={shared.title}>Histórico</Text>
      <Text style={shared.subtitle}>Consulte suas noites por período e toque em um dia para abrir os detalhes do registro.</Text>
      <View style={styles.filters}>
        <Chip label="7 dias" active={filter === '7'} onPress={() => handleFilterChange('7')} />
        <Chip label="30 dias" active={filter === '30'} onPress={() => handleFilterChange('30')} />
        <Chip label="Personalizado" active={filter === 'custom'} onPress={() => handleFilterChange('custom')} />
        <Chip label="Todos" active={filter === 'all'} onPress={() => handleFilterChange('all')} />
      </View>
      {filter === 'custom' && (
        <View style={shared.card}>
          <Text style={shared.label}>Período personalizado</Text>
          <TextInput style={[shared.input, showDateError(start) ? styles.inputError : null]} placeholder="Início AAAA-MM-DD" placeholderTextColor={colors.muted} value={start} onChangeText={setStart} />
          <TextInput style={[shared.input, showDateError(end) ? styles.inputError : null]} placeholder="Fim AAAA-MM-DD" placeholderTextColor={colors.muted} value={end} onChangeText={setEnd} />
          <Pressable style={shared.button} onPress={() => fetchRecords(true)}><Text style={shared.buttonText}>Aplicar filtro</Text></Pressable>
        </View>
      )}
      {loadError && (
        <View style={[shared.card, styles.errorCard]}>
          <Text style={styles.errorTitle}>Falha ao carregar histórico</Text>
          <Text style={shared.muted}>{loadError}</Text>
          <Pressable style={shared.outlineButton} onPress={() => fetchRecords(filter === 'custom')}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
        </View>
      )}
      <Text style={styles.sectionLabel}>REGISTROS DO PERÍODO</Text>
    </View>
  );

  return (
    <SafeAreaView style={shared.screen} edges={['top', 'left', 'right']}>
      {loading ? (
        <View style={[shared.screen, styles.loadingContent]}>
          <Text style={shared.muted}>Carregando histórico...</Text>
        </View>
      ) : (
        <FlatList
          style={shared.screen}
          contentContainerStyle={records.length ? styles.listContent : styles.emptyListContent}
          data={records}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={<Text style={shared.muted}>{loadError ? 'Histórico indisponível até a API responder.' : filter === 'custom' ? 'Aplique um filtro para buscar registros.' : 'Nenhum registro encontrado.'}</Text>}
          renderItem={({ item }) => {
            const key = dateKey(item.date);
            const itemColor = scoreColor(item.classification);
            const statusGeneral = statusByDate[key];
            return (
              <Pressable
                style={styles.recordCard}
                onPress={() => navigation.navigate('DetalheRegistro', { id: item.id, record: item })}
              >
                <View style={styles.recordTopRow}>
                  <View style={styles.recordDateBlock}>
                    <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={colors.subtle} />
                    <Text style={styles.date}>{key}</Text>
                  </View>
                  <Text style={[styles.badge, { color: itemColor, borderColor: itemColor }]}>{item.classification}</Text>
                </View>
                <View style={styles.infoGrid}>
                  <InfoCell label="Score total" value={String(item.scoreTotal ?? '—')} accent={itemColor} />
                  <InfoCell label="Status geral" value={validNumber(statusGeneral) ? String(Math.round(statusGeneral)) : '—'} accent={colors.primary} />
                  <InfoCell label="Sono" value={formatHours(item.totalHours)} />
                  <InfoCell label="Qualidade" value={formatScale(item.perceivedQuality)} />
                  <InfoCell label="Energia" value={formatScale(item.energy)} />
                  <InfoCell label="Despertares" value={item.awakenings >= 5 ? '5+' : String(item.awakenings ?? '—')} />
                </View>
                <View style={styles.openHint}>
                  <Text style={styles.openHintText}>Tocar para ver todas as marcações deste dia</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.subtle} />
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function InfoCell({ label, value, accent = colors.text }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.infoCell}>
      <Text style={[styles.infoValue, { color: accent }]}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContent: { paddingHorizontal: 18, paddingTop: 34 },
  listContent: { paddingHorizontal: 18, paddingTop: 24, paddingBottom: 170 },
  emptyListContent: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 170 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '900', fontSize: 13 },
  chipTextActive: { color: colors.white },
  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  recordDateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  date: { color: colors.text, fontWeight: '900', fontSize: 17 },
  badge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    fontWeight: '900',
    overflow: 'hidden',
    maxWidth: 130,
    textAlign: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoCell: {
    width: '31.7%',
    minHeight: 66,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  infoValue: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'center' },
  infoLabel: { color: colors.muted, fontSize: 10, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  openHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  openHintText: { color: colors.subtle, fontSize: 12, fontWeight: '800' },
  inputError: { borderColor: colors.danger },
  errorCard: { borderColor: colors.danger },
  errorTitle: {
    color: colors.danger,
    fontWeight: '900',
    fontSize: 16,
    marginBottom: 8,
  },
});
