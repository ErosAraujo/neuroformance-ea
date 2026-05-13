import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import api, { getApiErrorMessage } from '../services/api';
import { colors, shared } from '../theme';

type Insight = { id: string; title: string; description: string; level: 'positive' | 'neutral' | 'warning' };

export default function InsightsScreen() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/insights/mine');
      setInsights(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      setLoadError(getApiErrorMessage(error, 'Não foi possível carregar os insights.'));
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchInsights(); }, [fetchInsights]));

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <View style={shared.screen}>
        <View style={[shared.content, styles.content]}>
          <Text style={shared.title}>Insights</Text>
          <Text style={shared.subtitle}>Leituras curtas baseadas nos seus registros reais, sem laudo médico e sem chute bonito.</Text>
          {loadError && (
            <View style={[shared.card, styles.errorCard]}>
              <Text style={styles.errorTitle}>Falha ao carregar insights</Text>
              <Text style={shared.muted}>{loadError}</Text>
              <Pressable style={shared.outlineButton} onPress={fetchInsights}><Text style={shared.outlineText}>Tentar novamente</Text></Pressable>
            </View>
          )}
          {loading ? <Text style={shared.muted}>Carregando...</Text> : (
            <FlatList
              style={styles.list}
              contentContainerStyle={insights.length ? styles.listContent : styles.emptyListContent}
              data={insights}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={shared.muted}>{loadError ? 'Insights indisponíveis até a API responder.' : 'Nenhum insight disponível.'}</Text>}
              renderItem={({ item }) => <View style={[shared.card, styles[item.level]]}><Text style={shared.cardTitle}>{item.title}</Text><Text style={shared.muted}>{item.description}</Text></View>}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingBottom: 20 },
  emptyListContent: { flexGrow: 1 },
  positive: { borderColor: colors.success },
  neutral: { borderColor: colors.border },
  warning: { borderColor: colors.warning },
  errorCard: { borderColor: colors.danger },
  errorTitle: { color: colors.danger, fontWeight: '900', fontSize: 16, marginBottom: 8 },
});
