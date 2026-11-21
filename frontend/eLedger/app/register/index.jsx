import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { register } from '../../lib/api';
import { COLORS } from '../../constants/colors';

export default function RegisterScreen() {
    const { saveSession } = useAuth();

    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleRegister() {
        if (!name.trim() || !phone.trim() || !password.trim()) {
            Alert.alert('Missing fields', 'Please fill in all fields.');
            return;
        }
        if (password !== confirm) {
            Alert.alert('Password mismatch', 'Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Weak password', 'Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            // Calls POST /auth/register on your backend
            // Role defaults to 'owner' on the server — villagers register themselves
            // Officials are created by an admin directly in the database
            const { token, user } = await register(name.trim(), phone.trim(), password);

            await saveSession(token, user);
            router.replace('/(tabs)/my-lands');
        } catch (err) {
            Alert.alert('Registration failed', err.message);
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

                <TouchableOpacity onPress={() => router.back()} style={styles.back}>
                    <Text style={styles.backText}>← Back to login</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Create account</Text>
                <Text style={styles.sub}>
                    Register to view your land records
                </Text>

                <Text style={styles.label}>Full name</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Your full name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                />

                <Text style={styles.label}>Phone number</Text>
                <TextInput
                    style={styles.input}
                    placeholder="10-digit mobile number"
                    placeholderTextColor="#aaa"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Min 6 characters"
                    placeholderTextColor="#aaa"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                />

                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Re-enter password"
                    placeholderTextColor="#aaa"
                    secureTextEntry
                    value={confirm}
                    onChangeText={setConfirm}
                />

                <TouchableOpacity
                    style={[styles.btn, loading && styles.btnDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                >
                    {loading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.btnText}>Register</Text>
                    }
                </TouchableOpacity>

                <Text style={styles.note}>
                    Note: Your account will be linked to your land records by the Patwari office.
                </Text>

            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    inner: { flexGrow: 1, paddingHorizontal: 32, paddingVertical: 60 },
    back: { marginBottom: 32, alignSelf: 'flex-start', backgroundColor: COLORS.bg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
    backText: { fontSize: 13, color: COLORS.primary, fontWeight: '700', textTransform: 'uppercase' },
    title: { fontSize: 28, fontWeight: '800', color: COLORS.text, marginBottom: 8, letterSpacing: -0.5 },
    sub: { fontSize: 15, color: COLORS.textMuted, marginBottom: 40, fontWeight: '500' },
    label: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
    input: { borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, padding: 16, fontSize: 16, color: COLORS.text, backgroundColor: COLORS.bg, marginBottom: 20 },
    btn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 12, marginBottom: 24, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
    note: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
});