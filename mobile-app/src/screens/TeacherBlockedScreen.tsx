import React, { useContext } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors, shared } from '../theme';

export default function TeacherBlockedScreen() {
  const { logout } = useContext(AuthContext);
  return (
    <SafeAreaView style={[shared.screen, styles.center]} edges={['left', 'right']}>
      <View style={styles.card}>
        <Text style={styles.icon}>🧑‍🏫</Text>
        <Text style={styles.title}>Conta de professor detectada.</Text>
        <Text style={styles.text}>Use o Painel Web do Professor para acompanhar alunos, alertas e relatórios.</Text>
        <Pressable style={shared.button} onPress={logout}><Text style={shared.buttonText}>Sair da conta</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', padding: 22 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 24, padding: 24, alignItems: 'center' },
  icon: { fontSize: 46, marginBottom: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  text: { color: colors.muted, textAlign: 'center', lineHeight: 22, marginBottom: 22 },
});
