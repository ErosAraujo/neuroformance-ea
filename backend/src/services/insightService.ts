import { SleepRecordLike } from '../types/sleepRecord';

export interface SleepInsight {
  id: string;
  title: string;
  description: string;
  level: 'positive' | 'neutral' | 'warning';
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

export function buildSleepInsights(currentWeek: SleepRecordLike[], previousWeek: SleepRecordLike[]): SleepInsight[] {
  const insights: SleepInsight[] = [];
  const currentAvg = average(currentWeek.map((r) => r.scoreTotal));
  const previousAvg = average(previousWeek.map((r) => r.scoreTotal));
  const currentRegularity = average(currentWeek.map((r) => r.scoreRegularity));
  const previousRegularity = average(previousWeek.map((r) => r.scoreRegularity));
  const currentHours = average(currentWeek.map((r) => r.totalHours));
  const previousHours = average(previousWeek.map((r) => r.totalHours));

  if (currentWeek.length === 0) {
    insights.push({ id: 'sem-registros', title: 'Sem registros na semana', description: 'Ainda não há dados suficientes para gerar leitura da semana atual.', level: 'neutral' });
    return insights;
  }

  if (previousWeek.length > 0) {
    if (currentAvg >= previousAvg + 5) {
      insights.push({ id: 'score-melhorou', title: 'Sono melhorou nesta semana', description: `Sua média subiu de ${previousAvg.toFixed(1)} para ${currentAvg.toFixed(1)} pontos.`, level: 'positive' });
    } else if (currentAvg <= previousAvg - 5) {
      insights.push({ id: 'score-caiu', title: 'Sono piorou nesta semana', description: `Sua média caiu de ${previousAvg.toFixed(1)} para ${currentAvg.toFixed(1)} pontos.`, level: 'warning' });
    }

    if (currentRegularity < previousRegularity - 3) {
      insights.push({ id: 'regularidade-caiu', title: 'Regularidade caiu', description: 'A pontuação média de regularidade ficou menor que na semana anterior.', level: 'warning' });
    } else if (currentRegularity > previousRegularity + 3) {
      insights.push({ id: 'regularidade-melhorou', title: 'Regularidade melhorou', description: 'Seus horários ficaram mais consistentes em comparação com a semana anterior.', level: 'positive' });
    }

    if (currentHours < previousHours - 0.5) {
      insights.push({ id: 'horas-cairam', title: 'Você dormiu menos', description: `A média de horas caiu de ${previousHours.toFixed(1)}h para ${currentHours.toFixed(1)}h.`, level: 'warning' });
    } else if (currentHours > previousHours + 0.5) {
      insights.push({ id: 'horas-subiram', title: 'Você dormiu mais', description: `A média de horas subiu de ${previousHours.toFixed(1)}h para ${currentHours.toFixed(1)}h.`, level: 'positive' });
    }
  }

  const goodNights = currentWeek.filter((r) => r.scoreTotal >= 70).length;
  const badNights = currentWeek.filter((r) => r.scoreTotal < 55).length;
  if (goodNights >= 4) insights.push({ id: 'boas-noites', title: 'Boa sequência', description: `Você teve ${goodNights} noites boas nos últimos 7 dias registrados.`, level: 'positive' });
  if (badNights >= 3) insights.push({ id: 'noites-ruins', title: 'Atenção à sequência', description: `Você teve ${badNights} noites ruins no período recente.`, level: 'warning' });

  if (insights.length === 0) {
    insights.push({ id: 'estavel', title: 'Semana estável', description: 'Os dados atuais não mostram mudança relevante em relação ao padrão recente.', level: 'neutral' });
  }
  return insights;
}
