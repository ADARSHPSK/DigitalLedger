import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, StyleSheet,
    ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { getMyLands } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import LandCard from '../../components/LandCard';

export default function MyLandsScreen() {
    const { user, logout } = useAuth();

    // ── RBAC guard: officials don't belong here ───────────────────────────────
    // They have their own dashboard. Redirect immediately if they land here.
    useEffect(() => {
        if (user && (user.role === 'official' || user.role === 'admin')) {
            router.replace('/(tabs)/official');
        }
    }, [user]);

    const [lands, setLands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // Calls GET /land/my/lands — returns only lands linked to this user's account
    const fetchLands = useCallback(async () => {
        try {
            const data = await getMyLands();
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

    // Count how many lands have each status
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
                    <Text style={styles.headerTitle}>My land records</Text>
                    <Text style={styles.headerSub}>Namaste, {user?.name}</Text>
                </View>
                <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                    <Text style={styles.logoutText}>Log out</Text>
                </TouchableOpacity>
            </View>

            {/* Role badge */}
            <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>🧑‍🌾 Owner — read-only access</Text>
            </View>

            {/* Alert banners — only show if there are issues */}
            {counts.disputed > 0 && (
                <View style={[styles.alert, styles.alertDisputed]}>
                    <Text style={styles.alertText}>
                        {counts.disputed} plot{counts.disputed > 1 ? 's have' : ' has'} an active dispute
                    </Text>
                </View>
            )}
            {counts.under_review > 0 && (
                <View style={[styles.alert, styles.alertReview]}>
                    <Text style={[styles.alertText, { color: COLORS.review }]}>
                        {counts.under_review} plot{counts.under_review > 1 ? 's are' : ' is'} under official review
                    </Text>
                </View>
            )}

            {error && (
                <Text style={styles.error}>{error}</Text>
            )}

            {/* Land list */}
            <FlatList
                data={lands}
                keyExtractor={item => item._id}
                renderItem={({ item }) => <LandCard land={item} />}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={COLORS.primary}
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyTitle}>No land records yet</Text>
                        <Text style={styles.emptySub}>
                            Your plots will appear here once a Patwari links them to your account.
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14, borderBottomWidth: 0.5, borderColor: COLORS.border },
    headerTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text },
    headerSub: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
    logoutBtn: { padding: 6 },
    logoutText: { fontSize: 13, color: COLORS.disputed },
    roleBadge: { backgroundColor: '#F0FDF4', borderBottomWidth: 0.5, borderColor: '#86EFAC', paddingHorizontal: 16, paddingVertical: 7 },
    roleBadgeText: { fontSize: 12, color: '#166534', fontWeight: '500' },
    alert: { marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 8, borderLeftWidth: 3 },
    alertDisputed: { backgroundColor: COLORS.disputedBg, borderLeftColor: COLORS.disputed },
    alertReview: { backgroundColor: COLORS.reviewBg, borderLeftColor: COLORS.review },
    alertText: { fontSize: 13, color: COLORS.disputed, fontWeight: '500' },
    error: { margin: 16, color: COLORS.disputed, fontSize: 13 },
    list: { padding: 16, paddingBottom: 32 },
    emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
    emptyTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
    emptySub: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', lineHeight: 20 },
});