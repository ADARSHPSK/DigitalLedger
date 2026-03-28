import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useAuth } from '../../lib/AuthContext';
import { getFlaggedLands } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import LandCard from '../../components/LandCard';

const FILTERS = [
    { label: 'All', value: 'all' },
    { label: 'Disputed', value: 'disputed' },
    { label: 'Under review', value: 'under_review' },
];

export default function OfficialScreen() {
    const { user, logout } = useAuth();

    // ── RBAC guard: owners don't belong here ──────────────────────────────────
    useEffect(() => {
        if (user && user.role === 'owner') {
            router.replace('/(tabs)/my-lands');
        }
    }, [user]);

    const [lands, setLands] = useState([]);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Calls GET /land/official/flagged
    // Returns all disputed + under_review lands in this official's assigned villages
    const fetchLands = useCallback(async () => {
        try {
            const data = await getFlaggedLands();
            setLands(data);
            setError(null);
        } catch (err) {
            setError(err.message);
        }
    }, []);

    useEffect(() => {
        fetchLands().finally(() => setLoading(false));
    }, [fetchLands]);

    async function onRefresh() {
        setRefreshing(true);
        await fetchLands();
        setRefreshing(false);
    }

    // Filter client-side (data already fetched)
    const displayed = filter === 'all'
        ? lands
        : lands.filter(l => l.status === filter);

    const counts = {
        disputed: lands.filter(l => l.status === 'disputed').length,
        under_review: lands.filter(l => l.status === 'under_review').length,
    };

    if (loading) {
        return <ActivityIndicator style={styles.center} color={COLORS.primary} />;
    }

    return (
        <View style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Official dashboard</Text>
                    <Text style={styles.headerSub}>{user?.name}</Text>
                </View>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            {/* Role badge */}
            <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>🏛️ {user?.role === 'admin' ? 'Admin' : 'Official'} — write access</Text>
            </View>

            {/* Stat cards */}
            <View style={styles.statRow}>
                <View style={styles.statCard}>
                    <Text style={[styles.statNum, { color: COLORS.disputed }]}>
                        {counts.disputed}
                    </Text>
                    <Text style={styles.statLabel}>Disputed</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statNum, { color: COLORS.review }]}>
                        {counts.under_review}
                    </Text>
                    <Text style={styles.statLabel}>Under review</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statNum, { color: COLORS.text }]}>
                        {lands.length}
                    </Text>
                    <Text style={styles.statLabel}>Total flagged</Text>
                </View>
            </View>

            {/* Filter chips */}
            <View style={styles.filterRow}>
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.value}
                        style={[styles.chip, filter === f.value && styles.chipActive]}
                        onPress={() => setFilter(f.value)}
                    >
                        <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <FlatList
                data={displayed}
                keyExtractor={item => item._id}
                renderItem={({ item }) => <LandCard land={item} showOwner />}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                ListEmptyComponent={
                    <Text style={styles.empty}>
                        No flagged land records for your area.
                    </Text>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    headerSub: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, fontWeight: '500' },
    logoutBtn: { backgroundColor: COLORS.disputedBg, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.disputedBorder },
    logoutText: { fontSize: 11, color: COLORS.disputed, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    roleBadge: { backgroundColor: COLORS.primaryBg, borderBottomWidth: 1, borderColor: COLORS.accent, paddingHorizontal: 20, paddingVertical: 8 },
    roleBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    statRow: { flexDirection: 'row', gap: 12, padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    statCard: { flex: 1, backgroundColor: COLORS.bg, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: COLORS.borderLight },
    statNum: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
    statLabel: { fontSize: 10, color: COLORS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.borderLight, backgroundColor: COLORS.white },
    chipActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
    chipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    chipTextActive: { color: COLORS.primary, fontWeight: '700' },
    error: { margin: 20, color: COLORS.disputed, fontSize: 14, fontWeight: '500' },
    list: { padding: 20, paddingBottom: 40 },
    empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 15, fontWeight: '500' },
});