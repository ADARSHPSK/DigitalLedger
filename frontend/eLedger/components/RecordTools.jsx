import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { getIntegrity, summariseLand } from '../lib/api';
import { COLORS } from '../constants/colors';

// Two helpers shown on the land detail screen:
//   1. Integrity check — does this record still match its tamper-evident audit log?
//   2. AI summary      — one tap, plain-language summary of the whole history.
//
// Both are OPTIONAL extras. If either fails (server down, no AI key, rate limit) the
// rest of the screen keeps working — we show a quiet message and never block the record.
//
// props:
//   landId     — the plot's id
//   isOfficial — officials see the technical findings, owners see a plain message
//   refreshKey — change this (e.g. land.updatedAt) to re-run the check after an edit
export default function RecordTools({ landId, isOfficial, refreshKey }) {
    const [integrity, setIntegrity] = useState(undefined);   // undefined = loading, null = unavailable
    const [showDetails, setShowDetails] = useState(false);

    const [summary, setSummary] = useState(null);
    const [summarising, setSummarising] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    useEffect(() => {
        let alive = true;
        setIntegrity(undefined);
        getIntegrity(landId)
            .then(r => alive && setIntegrity(r))
            .catch(() => alive && setIntegrity(null));       // don't alarm users if the check itself fails
        // the record changed → an old summary would be out of date
        setSummary(null);
        setSummaryError(null);
        return () => { alive = false; };
    }, [landId, refreshKey]);

    const onSummarise = async () => {
        setSummarising(true);
        setSummaryError(null);
        try {
            const r = await summariseLand(landId);
            setSummary(r.summary);
        } catch (err) {
            setSummaryError(err.message || 'Summary is not available right now.');
        } finally {
            setSummarising(false);
        }
    };

    return (
        <View>
            {/* ── Integrity ─────────────────────────────────────────────── */}
            {integrity === undefined && (
                <Text style={styles.checking}>Checking record…</Text>
            )}

            {integrity && integrity.state === 'intact' && (
                <View style={[styles.banner, styles.ok]}>
                    <Text style={[styles.bannerTitle, { color: COLORS.clear }]}>✔ Record verified</Text>
                    <Text style={styles.bannerText}>No changes found since this record was written.</Text>
                </View>
            )}

            {integrity && integrity.state === 'tampered' && (
                <TouchableOpacity activeOpacity={0.8} onPress={() => setShowDetails(s => !s)} style={[styles.banner, styles.bad]}>
                    <Text style={[styles.bannerTitle, { color: COLORS.disputed }]}>⚠ This record needs attention</Text>
                    <Text style={styles.bannerText}>
                        It does not match its audit log. Please inform the Tehsil office.
                    </Text>
                    {isOfficial && (
                        <Text style={styles.moreLink}>{showDetails ? 'Hide details' : 'Show details'}</Text>
                    )}
                    {isOfficial && showDetails && (
                        <View style={{ marginTop: 6 }}>
                            {integrity.brokenAt && (
                                <Text style={styles.finding}>• {integrity.brokenAt.message} (block {integrity.brokenAt.seq})</Text>
                            )}
                            {integrity.issues.map((i, k) => (
                                <Text key={k} style={styles.finding}>• {i.message}</Text>
                            ))}
                        </View>
                    )}
                </TouchableOpacity>
            )}

            {integrity && integrity.state === 'not_anchored' && (
                <View style={[styles.banner, styles.neutral]}>
                    <Text style={styles.bannerText}>Audit protection is not switched on for this older record yet.</Text>
                </View>
            )}

            {/* ── AI summary ────────────────────────────────────────────── */}
            {!summary && (
                <TouchableOpacity style={styles.summariseBtn} onPress={onSummarise} disabled={summarising} activeOpacity={0.85}>
                    {summarising
                        ? <ActivityIndicator color={COLORS.primary} />
                        : <Text style={styles.summariseText}>✨ Summarise this record</Text>}
                </TouchableOpacity>
            )}

            {summaryError && (
                <View style={[styles.banner, styles.neutral]}>
                    <Text style={styles.bannerText}>{summaryError}</Text>
                </View>
            )}

            {summary && (
                <View style={styles.summaryBox}>
                    <View style={styles.summaryHead}>
                        <Text style={styles.summaryTitle}>AI SUMMARY</Text>
                        <TouchableOpacity onPress={() => setSummary(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={styles.close}>✕</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.summaryBody}>{summary}</Text>
                    <Text style={styles.disclaimer}>
                        Written by AI from the record below. It is not a legal document — the full history is the source of truth.
                    </Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    checking: { marginHorizontal: 20, marginTop: 12, fontSize: 12, color: COLORS.textMuted },

    banner: { marginHorizontal: 20, marginTop: 12, borderRadius: 14, padding: 14, borderWidth: 1 },
    ok: { backgroundColor: COLORS.clearBg, borderColor: COLORS.clearBorder },
    bad: { backgroundColor: COLORS.disputedBg, borderColor: COLORS.disputedBorder },
    neutral: { backgroundColor: COLORS.white, borderColor: COLORS.border },
    bannerTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
    bannerText: { fontSize: 13, color: COLORS.text, lineHeight: 18 },
    moreLink: { marginTop: 6, fontSize: 12, fontWeight: '700', color: COLORS.disputed },
    finding: { fontSize: 12, color: COLORS.disputed, lineHeight: 18 },

    summariseBtn: {
        marginHorizontal: 20, marginTop: 12, backgroundColor: COLORS.primaryBg,
        borderRadius: 14, paddingVertical: 13, alignItems: 'center',
        borderWidth: 1, borderColor: COLORS.primary,
    },
    summariseText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

    summaryBox: {
        marginHorizontal: 20, marginTop: 12, backgroundColor: COLORS.primaryBg,
        borderRadius: 14, padding: 16, borderLeftWidth: 4, borderLeftColor: COLORS.primary,
    },
    summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    summaryTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: COLORS.primary },
    close: { fontSize: 16, color: COLORS.primary, fontWeight: '700' },
    summaryBody: { fontSize: 14, color: COLORS.text, lineHeight: 21 },
    disclaimer: { marginTop: 10, fontSize: 11, color: COLORS.textMuted, lineHeight: 15 },
});
