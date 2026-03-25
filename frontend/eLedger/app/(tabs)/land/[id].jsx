import React, { useEffect, useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { getLand } from '../../../lib/api';
import { useAuth } from '../../../lib/AuthContext';
import { COLORS, STATUS_CONFIG, TRANSFER_LABELS } from '../../../constants/colors';
import StatusBadge from '../../../components/StatusBadge';

export default function LandDetailScreen() {
    // useLocalSearchParams reads the [id] from the URL
    // e.g. if route is /land/abc123  →  id = 'abc123'
    const { id } = useLocalSearchParams();
    const { user } = useAuth();

    const [land, setLand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Calls GET /land/:id — returns full land with ownershipHistory and officialComments
        getLand(id)
            .then(setLand)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [id]);

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
                <TouchableOpacity onPress={() => router.back()}>
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
                    {land.areaValue} {land.areaUnit} · {land.landType}
                </Text>
                <Text style={styles.plotMeta}>
                    {land.tehsil}, {land.district}, {land.state}
                </Text>
                <View style={styles.ownerRow}>
                    <Text style={styles.ownerLabel}>Current owner</Text>
                    <Text style={styles.ownerName}>{land.currentOwner}</Text>
                </View>
            </View>

            {/* ── Ownership Timeline ─────────────────────────────────────────────── */}
            <Text style={styles.sectionTitle}>Ownership history</Text>
            <View style={styles.timelineWrapper}>
                {/* Show newest first — reverse() mutates so we spread first */}
                {[...land.ownershipHistory].reverse().map((event, idx, arr) => (
                    <View key={event._id} style={styles.tlRow}>

                        {/* Dot + vertical line */}
                        <View style={styles.tlLeft}>
                            <View style={[
                                styles.tlDot,
                                { backgroundColor: COLORS.dots[event.transferType] || '#888' }
                            ]} />
                            {idx < arr.length - 1 && <View style={styles.tlLine} />}
                        </View>

                        {/* Event content */}
                        <View style={styles.tlContent}>
                            <Text style={styles.tlEvent}>
                                {TRANSFER_LABELS[event.transferType] || event.transferType}
                            </Text>
                            <Text style={styles.tlName}>{event.ownerName}</Text>
                            <Text style={styles.tlDate}>
                                {new Date(event.date).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'long', year: 'numeric'
                                })}
                            </Text>
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
                <>
                    <Text style={styles.sectionTitle}>Official comments</Text>
                    {[...land.officialComments].reverse().map(comment => {
                        const tagCfg = comment.tag ? STATUS_CONFIG[comment.tag] : null;
                        return (
                            <View key={comment._id} style={styles.commentCard}>
                                <View style={styles.commentHeader}>
                                    <Text style={styles.commentBy}>{comment.officialName}</Text>
                                    <Text style={styles.commentDate}>
                                        {new Date(comment.createdAt).toLocaleDateString('en-IN')}
                                    </Text>
                                </View>
                                {tagCfg && (
                                    <View style={[styles.tagPill, { backgroundColor: tagCfg.bg }]}>
                                        <Text style={[styles.tagText, { color: tagCfg.color }]}>
                                            Tagged as: {tagCfg.label}
                                        </Text>
                                    </View>
                                )}
                                <Text style={styles.commentText}>{comment.text}</Text>
                            </View>
                        );
                    })}
                </>
            )}

            {/* Officials see a button to add a comment */}
            {isOfficial && (
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/land/${id}/comment`)}
                >
                    <Text style={styles.actionBtnText}>Add comment / change status</Text>
                </TouchableOpacity>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { color: COLORS.disputed, fontSize: 14, marginBottom: 12 },
    backLink: { color: COLORS.primary, fontSize: 14 },
    headerBar: { backgroundColor: COLORS.white, paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: COLORS.border },
    backBtn: { fontSize: 14, color: COLORS.primary },
    summaryCard: { backgroundColor: COLORS.white, padding: 16, marginBottom: 8, borderBottomWidth: 0.5, borderColor: COLORS.border },
    summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
    plotTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, flex: 1 },
    plotMeta: { fontSize: 13, color: COLORS.textMuted, marginBottom: 2 },
    ownerRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderColor: COLORS.borderLight },
    ownerLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
    ownerName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    sectionTitle: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 10, paddingHorizontal: 16 },
    timelineWrapper: { paddingHorizontal: 16 },
    tlRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
    tlLeft: { alignItems: 'center', width: 16 },
    tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 3 },
    tlLine: { width: 1.5, flex: 1, backgroundColor: COLORS.border, marginTop: 4 },
    tlContent: { flex: 1, paddingBottom: 4 },
    tlEvent: { fontSize: 14, fontWeight: '600', color: COLORS.text },
    tlName: { fontSize: 13, color: COLORS.text, marginTop: 2 },
    tlDate: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
    tlDetail: { fontSize: 12, color: '#999', marginTop: 2 },
    noteBox: { backgroundColor: '#F0F0F0', borderRadius: 8, padding: 8, marginTop: 6 },
    noteText: { fontSize: 12, color: '#555', lineHeight: 18 },
    commentCard: { backgroundColor: COLORS.white, marginHorizontal: 16, marginBottom: 10, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: COLORS.border },
    commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    commentBy: { fontSize: 13, fontWeight: '600', color: COLORS.text },
    commentDate: { fontSize: 12, color: '#999' },
    tagPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginBottom: 6 },
    tagText: { fontSize: 11, fontWeight: '600' },
    commentText: { fontSize: 13, color: COLORS.textMuted, lineHeight: 19 },
    actionBtn: { margin: 16, backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center' },
    actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});