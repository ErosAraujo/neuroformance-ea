import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { colors } from '../theme';

type Props = {
  title: string;
  text: string;
  icon: string;
  color: string;
};

export default function InterpretationCard({ title, text, icon, color }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBubble, { backgroundColor: color === colors.primary ? colors.primarySoft : colors.successSoft }]}> 
        <MaterialCommunityIcons name={icon as any} size={25} color={color} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color }]}>{title}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(8,13,30,0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
  },
  iconBubble: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  title: { fontSize: 15, fontWeight: '900', marginBottom: 4 },
  text: { color: colors.text, lineHeight: 19, fontSize: 13 },
});
