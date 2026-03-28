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
                    <Text style={styles.logoutText}>Logout</Text>
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    headerSub: { fontSize: 14, color: COLORS.textMuted, marginTop: 4, fontWeight: '500' },
    logoutBtn: { backgroundColor: COLORS.disputedBg, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.disputedBorder },
    logoutText: { fontSize: 11, color: COLORS.disputed, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    roleBadge: { backgroundColor: COLORS.clearBg, borderBottomWidth: 1, borderColor: COLORS.clearBorder, paddingHorizontal: 20, paddingVertical: 8 },
    roleBadgeText: { fontSize: 11, color: COLORS.clear, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    alert: { marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
    alertDisputed: { backgroundColor: COLORS.disputedBg, borderColor: COLORS.disputedBorder },
    alertReview: { backgroundColor: COLORS.reviewBg, borderColor: COLORS.reviewBorder },
    alertText: { fontSize: 13, color: COLORS.disputed, fontWeight: '600', flex: 1 },
    error: { margin: 20, color: COLORS.disputed, fontSize: 14, fontWeight: '500' },
    list: { padding: 20, paddingBottom: 40 },
    emptyBox: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
    emptySub: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
});