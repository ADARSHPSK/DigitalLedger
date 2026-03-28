import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator, TextInput, Alert
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getLand, addComment, addTransfer } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { COLORS, STATUS_CONFIG, TRANSFER_LABELS } from '../../constants/colors';
import StatusBadge from '../../components/StatusBadge';

const TAGS = [
    { value: 'clear', label: 'Mark as clear', bg: COLORS.clearBg, color: COLORS.clear, border: COLORS.clearBorder },
    { value: 'under_review', label: 'Flag for review', bg: COLORS.reviewBg, color: COLORS.review, border: COLORS.reviewBorder },
    { value: 'disputed', label: 'Confirm dispute', bg: COLORS.disputedBg, color: COLORS.disputed, border: COLORS.disputedBorder },
];

const TRANSFER_TYPES = [
    { value: 'sale', label: 'Sale' },
    { value: 'inheritance', label: 'Inheritance' },
    { value: 'gift', label: 'Gift' },
    { value: 'court_order', label: 'Court Order' },
];

export default function LandDetailScreen() {
    // useLocalSearchParams reads the [id] from the URL
    // e.g. if route is /land/abc123  →  id = 'abc123'
    const { id } = useLocalSearchParams();
    const { user } = useAuth();

    const [land, setLand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Form state for inline commenting
    const [commentText, setCommentText] = useState('');
    const [selectedTag, setSelectedTag] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Form state for ownership transfer
    const [showTransferForm, setShowTransferForm] = useState(false);
    const [newOwner, setNewOwner] = useState('');
    const [selectedTransferType, setSelectedTransferType] = useState('sale');
    const [docRef, setDocRef] = useState('');
    const [transferNotes, setTransferNotes] = useState('');
    const [transferring, setTransferring] = useState(false);

    const fetchLandDetail = () => {
        getLand(id)
            .then(setLand)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchLandDetail();
    }, [id]);

    const submitComment = async () => {
        if (!commentText.trim()) {
            Alert.alert('Empty comment', 'Please write something before submitting.');
            return;
        }
        setSubmitting(true);
        try {
            await addComment(id, commentText.trim(), selectedTag);
            setCommentText('');
            setSelectedTag(null);
            fetchLandDetail();
            Alert.alert('Success', 'Comment and status updated.');
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const submitTransfer = async () => {
        if (!newOwner.trim() || !docRef.trim()) {
            Alert.alert('Missing fields', 'Owner name and Document Ref are required for transfers.');
            return;
        }
        setTransferring(true);
        try {
            await addTransfer(id, {
                ownerName: newOwner.trim(),
                transferType: selectedTransferType,
                date: new Date(),
                documentRef: docRef.trim(),
                notes: transferNotes.trim() || undefined
            });
            // Clear and close form
            setNewOwner('');
            setDocRef('');
            setTransferNotes('');
            setShowTransferForm(false);
            fetchLandDetail();
            Alert.alert('Transfer Successful', `Ownership has been transferred to ${newOwner.trim()}.`);
        } catch (err) {
            Alert.alert('Error', err.message);
        } finally {
            setTransferring(false);
        }
    };

    if (loading) {
        return <ActivityIndicator style={styles.center} color={COLORS.primary} />;
    }
    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backLink}>← Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }
    if (!land) return null;

    const isOfficial = user?.role === 'official' || user?.role === 'admin';

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 48 }}>

            {/* Back button */}
            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtnWrapper}>
                    <Text style={styles.backBtn}>← Back</Text>
                </TouchableOpacity>
            </View>

            {/* Plot summary card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                    <Text style={styles.plotTitle}>
                        Khasra #{land.khasraNo} — {land.village}
                    </Text>
                    <StatusBadge status={land.status} />
                </View>
                <Text style={styles.plotMeta}>
                    {land.areaValue} {land.areaUnit} • {land.landType}
                </Text>
                <Text style={styles.plotMeta}>
                    {land.village}, {land.tehsil}, {land.district}
                </Text>
                <View style={styles.ownerRow}>
                    <Text style={styles.ownerLabel}>Registered Owner</Text>
                    <Text style={styles.ownerName}>{land.currentOwner}</Text>
                </View>

                {isOfficial && (
                    <TouchableOpacity 
                        style={styles.transferToggle} 
                        onPress={() => setShowTransferForm(!showTransferForm)}
                    >
                        <Text style={styles.transferToggleText}>
                            {showTransferForm ? '✕ Cancel Transfer' : '🔄 Record Ownership Transfer'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* ── Ownership Transfer Form (Only for Officials) ────────────────────── */}
            {isOfficial && showTransferForm && (
                <View style={styles.transferForm}>
                    <Text style={styles.formTitle}>New Ownership Entry</Text>
                    
                    <Text style={styles.inputLabel}>New Owner Name</Text>
                    <TextInput
                        style={styles.formInput}
                        placeholder="Full legal name of the new owner"
                        value={newOwner}
                        onChangeText={setNewOwner}
                    />

                    <Text style={styles.inputLabel}>Transfer Type</Text>
                    <View style={styles.typeRow}>
                        {TRANSFER_TYPES.map(t => (
                            <TouchableOpacity
                                key={t.value}
                                style={[styles.typeBtn, selectedTransferType === t.value && styles.typeBtnActive]}
                                onPress={() => setSelectedTransferType(t.value)}
                            >
                                <Text style={[styles.typeBtnText, selectedTransferType === t.value && styles.typeBtnTextActive]}>
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={styles.inputLabel}>Document Reference (Deed/Will #)</Text>
                    <TextInput
                        style={styles.formInput}
                        placeholder="e.g. SALE-DEED-2026-X1"
                        value={docRef}
                        onChangeText={setDocRef}
                    />

                    <Text style={styles.inputLabel}>Notes</Text>
                    <TextInput
                        style={[styles.formInput, { height: 60 }]}
                        placeholder="Additional details..."
                        multiline
                        value={transferNotes}
                        onChangeText={setTransferNotes}
                    />

                    <TouchableOpacity
                        style={[styles.transferSubmit, transferring && { opacity: 0.6 }]}
                        onPress={submitTransfer}
                        disabled={transferring}
                    >
                        {transferring 
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.transferSubmitText}>Complete Transfer</Text>
                        }
                    </TouchableOpacity>
                </View>
            )}

            {/* ── Ownership Timeline ─────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Ownership history</Text>

            {land._isRestricted ? (
                <View style={styles.restrictedCard}>
                    <Text style={styles.restrictedIcon}>🔒</Text>
                    <Text style={styles.restrictedTitle}>Access restricted</Text>
                    <Text style={styles.restrictedText}>
                        Full ownership timeline and official comments are only visible to the registered landowner and authorized officials.
                    </Text>
                </View>
            ) : (
                <>
                    <View style={styles.timelineWrapper}>
                        {/* Show newest first — using (land.ownershipHistory || []) to prevent crash */}
                        {(land.ownershipHistory || []).slice().reverse().map((event, idx, arr) => (
                            <View key={event._id || idx} style={styles.tlRow}>

                                {/* Dot + vertical line */}
                                <View style={styles.tlLeft}>
                                    <View style={[
                                        styles.tlDot,
                                        { backgroundColor: (COLORS.dots && COLORS.dots[event.transferType]) || '#888' }
                                    ]} />
                                    {idx < arr.length - 1 && <View style={styles.tlLine} />}
                                </View>

                                {/* Event content */}
                                <View style={styles.tlContent}>
                                    <Text style={styles.tlEvent}>
                                        {TRANSFER_LABELS[event.transferType] || event.transferType}
                                    </Text>
                                    <Text style={styles.tlName}>{event.ownerName}</Text>
                                    <View style={styles.tlDateRow}>
                                        <Text style={styles.tlDate}>
                                            {event.date ? new Date(event.date).toLocaleDateString('en-IN', {
                                                day: 'numeric', month: 'long', year: 'numeric'
                                            }) : 'Date unknown'}
                                        </Text>
                                    </View>
                                    {event.documentRef && (
                                        <Text style={styles.tlDetail}>Deed ref: {event.documentRef}</Text>
                                    )}
                                    {event.recordedBy && (
                                        <Text style={styles.tlDetail}>Recorded by: {event.recordedBy}</Text>
                                    )}
                                    {event.notes && (
                                        <View style={styles.noteBox}>
                                            <Text style={styles.noteText}>{event.notes}</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* ── Official Comments ──────────────────────────────────────────────── */}
                    {land.officialComments?.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={styles.sectionTitle}>Official audit trail</Text>
                            {[...land.officialComments].reverse().map(comment => {
                                const tagCfg = comment.tag ? STATUS_CONFIG[comment.tag] : null;
                                return (
                                    <View key={comment._id} style={styles.commentCard}>
                                        <View style={styles.commentHeader}>
                                            <Text style={styles.commentBy}>{comment.officialName}</Text>
                                            <Text style={styles.commentDate}>
                                                {new Date(comment.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric', month: 'short'
                                                })}
                                            </Text>
                                        </View>
                                        <Text style={styles.commentText}>{comment.text}</Text>
                                        {tagCfg && (
                                            <View style={[styles.tagPill, { backgroundColor: tagCfg.bg, borderColor: tagCfg.border }]}>
                                                <Text style={[styles.tagText, { color: tagCfg.color }]}>
                                                    STATUS: {tagCfg.label.toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </>
            )}

            {/* Inline Comment Form for Officials */}
            {isOfficial && (
                <View style={styles.formContainer}>
                    <Text style={styles.sectionTitle}>Add a comment / update status</Text>
                    
                    <TextInput
                        style={styles.textarea}
                        placeholder="Describe your observation, required action, or decision…"
                        placeholderTextColor="#aaa"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                        value={commentText}
                        onChangeText={setCommentText}
                    />

                    <Text style={styles.labelHint}>Optional: Tags will update the land's public status.</Text>
                    <View style={styles.tagsContainer}>
                        {TAGS.map(t => (
                            <TouchableOpacity
                                key={t.value}
                                style={[
                                    styles.tagBtn,
                                    { borderColor: t.border },
                                    selectedTag === t.value && { backgroundColor: t.bg },
                                ]}
                                onPress={() => setSelectedTag(prev => prev === t.value ? null : t.value)}
                            >
                                <Text style={[styles.tagBtnText, { color: t.color }]}>{t.label}</Text>
                                {selectedTag === t.value && (
                                    <Text style={[styles.tagCheck, { color: t.color }]}>✓</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity
                        style={[styles.submitBtn, submitting && styles.submitDisabled]}
                        onPress={submitComment}
                        disabled={submitting}
                    >
                        {submitting
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.submitText}>
                                Submit comment{selectedTag ? ' + tag' : ''}
                            </Text>
                        }
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { color: COLORS.disputed, fontSize: 14, marginBottom: 12 },
    backLink: { color: COLORS.primary, fontSize: 14 },
    headerBar: { backgroundColor: COLORS.white, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    backBtnWrapper: { backgroundColor: COLORS.bg, alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
    backBtn: { fontSize: 13, color: COLORS.primary, fontWeight: '700', textTransform: 'uppercase' },
    summaryCard: { backgroundColor: COLORS.white, padding: 20, marginBottom: 8, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    plotTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, flex: 1, marginRight: 8 },
    plotMeta: { fontSize: 13, color: COLORS.textMuted, marginBottom: 4, fontWeight: '500' },
    ownerRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: COLORS.borderLight },
    ownerLabel: { fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700', marginBottom: 4 },
    ownerName: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
    sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 28, marginBottom: 16, paddingHorizontal: 20 },
    timelineWrapper: { paddingHorizontal: 20 },
    tlRow: { flexDirection: 'row', marginBottom: 24 },
    tlLeft: { alignItems: 'center', width: 24, marginRight: 12 },
    tlDot: { width: 14, height: 14, borderRadius: 7, marginTop: 4, borderWidth: 2, borderColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    tlLine: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 6 },
    tlContent: { flex: 1, paddingBottom: 8 },
    tlEvent: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    tlName: { fontSize: 14, color: COLORS.text, marginTop: 4, fontWeight: '500' },
    tlDateRow: { marginTop: 4 },
    tlDate: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
    tlDetail: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
    noteBox: { backgroundColor: COLORS.borderLight, borderRadius: 10, padding: 12, marginTop: 8 },
    noteText: { fontSize: 13, color: COLORS.text, lineHeight: 20 },
    commentCard: { backgroundColor: COLORS.white, marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
    commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    commentBy: { fontSize: 14, fontWeight: '700', color: COLORS.text },
    commentDate: { fontSize: 11, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase' },
    tagPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 10, borderWidth: 1 },
    tagText: { fontSize: 10, fontWeight: '800' },
    commentText: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
    restrictedCard: { backgroundColor: COLORS.white, marginHorizontal: 20, borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderLight, marginTop: 8 },
    restrictedIcon: { fontSize: 32, marginBottom: 16 },
    restrictedTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
    restrictedText: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
    formContainer: { marginHorizontal: 20, marginTop: 16, padding: 20, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    textarea: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 15, color: COLORS.text, minHeight: 100, marginBottom: 12, backgroundColor: COLORS.bg },
    labelHint: { fontSize: 12, color: COLORS.textMuted, marginBottom: 10, fontWeight: '500' },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    tagBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderColor: COLORS.border },
    tagBtnText: { fontSize: 13, fontWeight: '600' },
    tagCheck: { fontSize: 13, fontWeight: '700', marginLeft: 6 },
    submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
    transferToggle: { marginTop: 16, backgroundColor: COLORS.primaryBg, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: COLORS.accent },
    transferToggleText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
    transferForm: { margin: 20, padding: 20, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: COLORS.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 15, elevation: 4 },
    formTitle: { fontSize: 16, fontWeight: '800', marginBottom: 20, color: COLORS.text },
    inputLabel: { fontSize: 11, fontWeight: '700', color: COLORS.textMuted, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
    formInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.bg },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    typeBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.white },
    typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    typeBtnText: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
    typeBtnTextActive: { color: COLORS.white, fontWeight: '700' },
    transferSubmit: { backgroundColor: '#059669', marginTop: 24, padding: 16, borderRadius: 12, alignItems: 'center' },
    transferSubmitText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
});