import React, { useState, useContext } from 'react';
import { Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { colors, shared } from '../theme';
import { getApiErrorMessage } from '../services/api';

export default function RegisterScreen() {
  const { register } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teacherCode, setTeacherCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (loading) return;
    if (password !== confirmPassword) return setError('As senhas não coincidem.');
    if (!name.trim() || !email.trim() || !password) return setError('Preencha nome, e-mail e senha.');
    if (!teacherCode.trim()) return setError('Informe o código do professor para vincular sua conta ao painel.');
    setLoading(true);
    try { setError(null); await register(name.trim(), email.trim(), password, teacherCode.trim()); }
    catch (err: any) { setError(getApiErrorMessage(err, 'Erro ao cadastrar aluno.')); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={shared.screen} edges={['left', 'right']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={shared.screen}>
        <ScrollView contentContainerStyle={shared.content} keyboardShouldPersistTaps="handled">
        <Text style={shared.title}>Criar conta de aluno</Text>
        <Text style={shared.subtitle}>O mobile-app é exclusivo para alunos. Informe o código do professor para aparecer no painel de acompanhamento.</Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <TextInput style={shared.input} placeholder="Nome completo" placeholderTextColor={colors.muted} value={name} onChangeText={setName} editable={!loading} />
        <TextInput style={shared.input} placeholder="E-mail" placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" editable={!loading} />
        <TextInput style={shared.input} placeholder="Senha" placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} secureTextEntry editable={!loading} />
        <TextInput style={shared.input} placeholder="Confirmar senha" placeholderTextColor={colors.muted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry editable={!loading} />
        <TextInput style={shared.input} placeholder="Código do professor" placeholderTextColor={colors.muted} value={teacherCode} onChangeText={setTeacherCode} keyboardType="numeric" editable={!loading} />
        <Pressable style={[shared.button, loading && styles.disabled]} onPress={handleRegister} disabled={loading}><Text style={shared.buttonText}>{loading ? 'Cadastrando...' : 'Cadastrar aluno'}</Text></Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({ error: { color: colors.danger, marginBottom: 12, fontWeight: '800' }, disabled: { opacity: 0.65 } });
