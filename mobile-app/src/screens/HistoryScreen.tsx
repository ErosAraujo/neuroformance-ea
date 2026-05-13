import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import api, { getApiErrorMessage } from '../services/api';
import { SleepRecord } from '../types';
import { colors, scoreColor, shared } from '../theme';

type FilterMode = '7' | '30' | 'custom' | 'all';

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const [records, setRecords] = useState<SleepRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>('7');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const showDateError = (value: string) => value.length >= 10 && !validDate(value);

  const fetchRecords = useCallback(async (validateCustom = false) => {
    if (filter === 'custom') {
      if (!validateCustom) return;
      if (start && !validDate(start)) return Alert.alert('Data inválida', 'Revise a data inicial no formato AAAA-MM-DD.');
      if (end && !validDate(end)) return Alert.alert('Data inválida', 'Revise a data final no formato AAAA-MM-DD.');
      if (start && end && new Date(start) > new Date(end)) return Alert.alert('Período inválido', 'A data inicial não pode ser maior que a data final.');
    }
    setLoading(true);
    setLoadError(null);
    try {
      let query = '';
      if (filter === '7' || filter === '30') query = `?days=${filter}`;
      if (filter === 'custom') {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        query = params.toString() ? `?${params.toString()}` : '';
      }
      const res = await api.get(`/sleep-records${query}`);
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível carregar o histórico.'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [filter, start, end]);

  useFocusEffect(useCallback(() => { if (filter !== 'custom') fetchRecords(false); }, [filter, fetchRecords]));

  const handleFilterChange = (nextFilter: FilterMode) => {
    setFilter(nextFilter);
    setLoadError(null);
    if (nextFilter === 'custom') setLoading(false);
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <View style={shared.screen}>
        <View style={[shared.content, styles.content]}>
          <Text style={shared.title}>Histórico</Text>
          <Text style={shared.subtitle}>Consulte suas noites por período e abra qualquer registro para ver os pilares do score.</Text>
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
          {loading ? (
            <Text style={shared.muted}>Carregando...</Text>
          ) : (
            <FlatList
              style={styles.list}
              contentContainerStyle={records.length ? styles.listContent : styles.emptyListContent}
              data={records}
              keyExtractor={(item) => item.id.toString()}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={shared.muted}>{loadError ? 'Histórico indisponível até a API responder.' : filter === 'custom' ? 'Aplique um filtro para buscar registros.' : 'Nenhum registro encontrado.'}</Text>}
              renderItem={({ item }) => (
                <Pressable style={shared.card} onPress={() => navigation.navigate('DetalheRegistro', { id: item.id, record: item })}>
                  <View style={styles.row}>
                    <Text style={styles.date}>{String(item.date).slice(0, 10)}</Text>
                    <Text style={[styles.badge, { color: scoreColor(item.classification), borderColor: scoreColor(item.classification) }]}>{item.classification}</Text>
                  </View>
                  <Text style={styles.score}>Score {item.scoreTotal}</Text>
                  <Text style={shared.muted}>{Number(item.totalHours).toFixed(1)}h • Qualidade {item.perceivedQuality}/5 • {item.awakenings >= 5 ? '5+' : item.awakenings} despertares</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  emptyListContent: { flexGrow: 1 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.surfaceAlt },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '800' },
  chipTextActive: { color: colors.white },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'center' },
  date: { color: colors.text, fontWeight: '900', fontSize: 16 },
  badge: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8, fontWeight: '900' },
  score: { color: colors.text, fontWeight: '900', fontSize: 18, marginTop: 8, marginBottom: 4 },
  inputError: { borderColor: colors.danger },
  errorCard: { borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 16, marginBottom: 8 },
});
