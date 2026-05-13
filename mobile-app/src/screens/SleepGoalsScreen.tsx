import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api, { getApiErrorMessage } from '../services/api';
import { colors, shared } from '../theme';

function timeFromIso(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

export default function SleepGoalsScreen() {
  const [goal, setGoal] = useState<{ hoursGoal?: string; sleepTimeGoal?: string; wakeTimeGoal?: string; regularityGoal?: string }>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchGoal = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/sleep-goals/active');
      if (res.data) setGoal({ hoursGoal: String(res.data.hoursGoal ?? ''), sleepTimeGoal: timeFromIso(res.data.sleepTimeGoal), wakeTimeGoal: timeFromIso(res.data.wakeTimeGoal), regularityGoal: String(res.data.regularityGoal ?? '') });
      else setGoal({});
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível carregar a meta de sono.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchGoal(); }, [fetchGoal]));

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <ScrollView style={shared.screen} contentContainerStyle={shared.content}>
        <Text style={shared.title}>Meta de sono</Text>
        <Text style={shared.subtitle}>Esta meta é definida pelo professor. Consulte seu professor para alterá-la.</Text>
        {loading ? <Text style={shared.muted}>Carregando...</Text> : (
          <>
            {loadError && (
              <View style={[shared.card, styles.errorCard]}>
                <Text style={styles.errorTitle}>Falha ao carregar meta</Text>
                <Text style={shared.muted}>{loadError}</Text>
                <Pressable style={shared.outlineButton} onPress={fetchGoal}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
              </View>
            )}
            <ReadOnly label="Meta mínima de horas" value={goal.hoursGoal || '—'} />
            <ReadOnly label="Horário alvo para dormir" value={goal.sleepTimeGoal || '—'} />
            <ReadOnly label="Horário alvo para acordar" value={goal.wakeTimeGoal || '—'} />
            <ReadOnly label="Meta de regularidade (minutos)" value={goal.regularityGoal || '—'} />
            <View style={{ marginTop: 20 }}><Text style={shared.muted}>Apenas seu professor pode definir ou alterar estas metas.</Text></View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Text style={shared.label}>{label}</Text>
      <Text style={[shared.input, styles.readOnly]}>{value}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  readOnly: { color: colors.text, paddingVertical: 12 },
  errorCard: { borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 16, marginBottom: 8 },
});
