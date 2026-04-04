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
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC' // 🔥 soft background
    },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // 🔷 Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 16,
    },

    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.text,
        letterSpacing: -0.5
    },

    headerSub: {
        fontSize: 13,
        color: COLORS.textMuted,
        marginTop: 4
    },

    logoutBtn: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
    },

    logoutText: {
        fontSize: 11,
        color: COLORS.disputed,
        fontWeight: '700'
    },

    // 🏛️ Role badge
    roleBadge: {
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: COLORS.primary,
        paddingVertical: 8,
        borderRadius: 12,
        alignItems: 'center',
    },

    roleBadgeText: {
        fontSize: 11,
        color: '#fff',
        fontWeight: '700',
    },

    // 📊 Stats
    statRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 20,
        marginBottom: 10,
    },

    statCard: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',

        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
    },

    statNum: {
        fontSize: 20,
        fontWeight: '800',
        marginBottom: 4
    },

    statLabel: {
        fontSize: 10,
        color: COLORS.textMuted,
        fontWeight: '600',
    },

    // 🎯 Filters
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: 20,
        marginBottom: 6,
    },

    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20, // 🔥 pill
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },

    chipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },

    chipText: {
        fontSize: 11,
        color: COLORS.textMuted,
        fontWeight: '600'
    },

    chipTextActive: {
        color: '#fff',
        fontWeight: '700'
    },

    // ⚠️ Error
    error: {
        marginHorizontal: 20,
        marginVertical: 10,
        color: COLORS.disputed,
        fontSize: 13
    },

    // 📋 List
    list: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 100, // 🔥 space for floating tab
    },

    empty: {
        textAlign: 'center',
        color: COLORS.textMuted,
        marginTop: 80,
        fontSize: 14
    },
});