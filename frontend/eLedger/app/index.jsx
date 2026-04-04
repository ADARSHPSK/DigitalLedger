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
        <Text style={styles.appName}>Digital-Bhulekh</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC' // 🔥 soft gray bg
  },

  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40
  },

  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 6,
    letterSpacing: -0.5
  },

  tagline: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginBottom: 40,
    fontWeight: '500'
  },

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1
  },

  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },

  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 16,

    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },

  btnDisabled: { opacity: 0.6 },

  btnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700'
  },

  registerLink: {
    alignItems: 'center',
    marginTop: 6
  },

  registerText: {
    fontSize: 14,
    color: COLORS.textMuted
  },

  registerHighlight: {
    color: COLORS.primary,
    fontWeight: '700'
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 18
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },

  dividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase'
  },

  // Quick buttons
  quickRow: {
    flexDirection: 'row',
    gap: 10
  },

  quickBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: '#FFFFFF',

    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  quickOfficer: {
    borderColor: '#DBEAFE'
  },

  quickUser: {
    borderColor: '#DCFCE7'
  },

  quickIcon: {
    fontSize: 26,
    marginBottom: 6
  },

  quickLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text
  },

  quickHint: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 3,
    textTransform: 'uppercase'
  },

  // Seed note
  seedNote: {
    marginTop: 26,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18
  },

  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: COLORS.text,
    fontWeight: '600'
  },
});