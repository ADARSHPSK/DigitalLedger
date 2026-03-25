import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../../../lib/AuthContext';
import { addComment } from '../../../../lib/api';
import { COLORS } from '../../../../constants/colors';

const TAGS = [
    { value: 'clear', label: 'Mark as clear', bg: '#EAF3DE', color: '#3B6D11', border: '#639922' },
    { value: 'under_review', label: 'Flag for review', bg: '#FAEEDA', color: '#854F0B', border: '#BA7517' },
    { value: 'disputed', label: 'Confirm dispute', bg: '#FCEBEB', color: '#A32D2D', border: '#E24B4A' },
];

export default function AddCommentScreen() {
    const { id } = useLocalSearchParams();
    const { user } = useAuth();

    // ── RBAC guard: absolute protection against owners adding comments ────────
    React.useEffect(() => {
        if (user && user.role === 'owner') {
            Alert.alert('Access Denied', 'Only officials can add comments or update status.', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        }
    }, [user]);

    const [text, setText] = useState('');
    const [tag, setTag] = useState(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        if (!text.trim()) {
            Alert.alert('Empty comment', 'Please write something before submitting.');
            return;
        }
        setLoading(true);
        try {
            // Calls POST /land/:id/comment  →  body: { text, tag }
            await addComment(id, text.trim(), tag);
            Alert.alert('Submitted', 'Comment recorded successfully.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
            <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.back}>← Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Add official comment</Text>
            <Text style={styles.sub}>
                Your name, designation, and timestamp will be permanently recorded on this land entry.
            </Text>

            <Text style={styles.label}>Comment</Text>
            <TextInput
                style={styles.textarea}
                placeholder="Describe your observation, required action, or decision…"
                placeholderTextColor="#aaa"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                value={text}
                onChangeText={setText}
            />

            <Text style={styles.label}>Tag land status (optional)</Text>
            <Text style={styles.labelHint}>
                Selecting a tag will update the land's status visible to the owner.
            </Text>

            {TAGS.map(t => (
                <TouchableOpacity
                    key={t.value}
                    style={[
                        styles.tagBtn,
                        { borderColor: t.border },
                        tag === t.value && { backgroundColor: t.bg },
                    ]}
                    onPress={() => setTag(prev => prev === t.value ? null : t.value)}
                >
                    <Text style={[styles.tagBtnText, { color: t.color }]}>{t.label}</Text>
                    {tag === t.value && (
                        <Text style={[styles.tagCheck, { color: t.color }]}>✓ Selected</Text>
                    )}
                </TouchableOpacity>
            ))}

            <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitDisabled]}
                onPress={handleSubmit}
                disabled={loading}
            >
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.submitText}>
                        Submit comment{tag ? ' + tag' : ''}
                    </Text>
                }
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    inner: { padding: 24, paddingTop: 56, paddingBottom: 48 },
    back: { color: COLORS.primary, fontSize: 14, marginBottom: 24 },
    title: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
    sub: { fontSize: 13, color: COLORS.textMuted, marginBottom: 28, lineHeight: 20 },
    label: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    labelHint: { fontSize: 12, color: '#999', marginBottom: 10, marginTop: -4 },
    textarea: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, minHeight: 120, marginBottom: 24 },
    tagBtn: { borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tagBtnText: { fontSize: 14, fontWeight: '500' },
    tagCheck: { fontSize: 12, fontWeight: '600' },
    submitBtn: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 12 },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});