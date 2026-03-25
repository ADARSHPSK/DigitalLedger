import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../lib/AuthContext';
import { login } from '../lib/api';
import { COLORS } from '../constants/colors';

export default function LoginScreen() {
  const { saveSession } = useAuth();

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter phone number and password.');
      return;
    }

    setLoading(true);
    try {
      const { token, user } = await login(phone.trim(), password);
      await saveSession(token, user);

      if (user.role === 'official' || user.role === 'admin') {
        router.replace('/(tabs)/official');
      } else {
        router.replace('/(tabs)/my-lands');
      }
    } catch (err) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  // Quick login helper — pre-fills and immediately logs in
  async function quickLogin(ph, pw, destination) {
    setPhone(ph);
    setPassword(pw);
    setLoading(true);
    try {
      const { token, user } = await login(ph, pw);
      await saveSession(token, user);
      router.replace(destination);
    } catch (err) {
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">

        {/* App name + tagline */}
        <Text style={styles.appName}>BhoomiLedger</Text>
        <Text style={styles.tagline}>Village land ownership registry</Text>

        {/* Phone input */}
        <Text style={styles.label}>Phone number</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your phone number"
          placeholderTextColor="#aaa"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          autoComplete="tel"
        />

        {/* Password input */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your password"
          placeholderTextColor="#aaa"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {/* Login button */}
        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Log in</Text>
          }
        </TouchableOpacity>

        {/* Register link */}
        <TouchableOpacity
          style={styles.registerLink}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.registerText}>
            New user? <Text style={styles.registerHighlight}>Register here</Text>
          </Text>
        </TouchableOpacity>

        {/* ── Quick / Demo Login ─────────────────────────────────────────── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Quick test login</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.quickRow}>
          {/* Officer (Patwari) — write access */}
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickOfficer]}
            disabled={loading}
            onPress={() => quickLogin('1111111111', 'officer123', '/(tabs)/official')}
          >
            <Text style={styles.quickIcon}>🏛️</Text>
            <Text style={styles.quickLabel}>Officer</Text>
            <Text style={styles.quickHint}>Write access</Text>
          </TouchableOpacity>

          {/* Owner — read access */}
          <TouchableOpacity
            style={[styles.quickBtn, styles.quickUser]}
            disabled={loading}
            onPress={() => quickLogin('2222222222', 'user123', '/(tabs)/my-lands')}
          >
            <Text style={styles.quickIcon}>🧑‍🌾</Text>
            <Text style={styles.quickLabel}>Owner</Text>
            <Text style={styles.quickHint}>Read access</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.seedNote}>
          Run <Text style={styles.codeText}>node seed.js</Text> in the backend folder first to populate test data.
        </Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 48 },
  appName: { fontSize: 30, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  tagline: { fontSize: 14, color: COLORS.textMuted, marginBottom: 40 },
  label: { fontSize: 13, fontWeight: '500', color: COLORS.textMuted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, fontSize: 15, color: COLORS.text, backgroundColor: '#FAFAFA', marginBottom: 18 },
  btn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4, marginBottom: 18 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  registerLink: { alignItems: 'center' },
  registerText: { fontSize: 14, color: COLORS.textMuted },
  registerHighlight: { color: COLORS.primary, fontWeight: '500' },

  // Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 32, marginBottom: 14 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: 10, fontSize: 11, color: COLORS.textMuted },

  // Quick buttons
  quickRow: { flexDirection: 'row', gap: 12 },
  quickBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  quickOfficer: { backgroundColor: '#EEF2FF', borderColor: '#A5B4FC' },
  quickUser:    { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  quickIcon:  { fontSize: 24, marginBottom: 4 },
  quickLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  quickHint:  { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  // Seed note
  seedNote: { marginTop: 16, fontSize: 11, color: COLORS.textMuted, textAlign: 'center', lineHeight: 16 },
  codeText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: COLORS.text },
});