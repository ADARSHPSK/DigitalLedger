import React, { useState, useCallback } from 'react';
import {
    View, Text, TextInput, FlatList, TouchableOpacity,
    StyleSheet, ActivityIndicator,
} from 'react-native';
import { searchLands } from '../../lib/api';
import { COLORS } from '../../constants/colors';
import LandCard from '../../components/LandCard';

// Status filter options — '' means no filter (all results)
const FILTERS = [
    { label: 'All', value: '' },
    { label: 'Clear', value: 'clear' },
    { label: 'Under review', value: 'under_review' },
    { label: 'Disputed', value: 'disputed' },
];

export default function SearchScreen() {
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false); // whether user has searched yet
    const [error, setError] = useState(null);

    // Calls GET /land/search?q=...&status=...
    const doSearch = useCallback(async (q, s) => {
        setLoading(true);
        setError(null);
        try {
            const data = await searchLands({ q: q || undefined, status: s || undefined });
            setResults(data);
            setSearched(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    function handleSearch() {
        if (!query.trim() && !status) return;
        doSearch(query.trim(), status);
    }

    function handleFilterChange(value) {
        setStatus(value);
        // If user already typed something, re-search immediately with new filter
        if (searched) {
            doSearch(query.trim(), value);
        }
    }

    return (
        <View style={styles.container}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Search land records</Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Khasra no., owner name, village…"
                    placeholderTextColor="#aaa"
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={handleSearch}
                    returnKeyType="search"
                />
                <TouchableOpacity
                    style={styles.searchBtn}
                    onPress={handleSearch}
                    disabled={loading}
                >
                    <Text style={styles.searchBtnText}>Search</Text>
                </TouchableOpacity>
            </View>

            {/* Status filters */}
            <View style={styles.filterRow}>
                {FILTERS.map(f => (
                    <TouchableOpacity
                        key={f.value}
                        style={[styles.chip, status === f.value && styles.chipActive]}
                        onPress={() => handleFilterChange(f.value)}
                    >
                        <Text style={[styles.chipText, status === f.value && styles.chipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Results */}
            {loading ? (
                <ActivityIndicator style={styles.center} color={COLORS.primary} />
            ) : error ? (
                <Text style={styles.error}>{error}</Text>
            ) : (
                <FlatList
                    data={results}
                    keyExtractor={item => item._id}
                    renderItem={({ item }) => <LandCard land={item} showOwner />}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        searched ? (
                            <Text style={styles.empty}>No matching land records found.</Text>
                        ) : (
                            <Text style={styles.hint}>
                                Search by khasra number, owner name, or village name.{'\n'}
                                You can also filter by status below.
                            </Text>
                        )
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    header: { backgroundColor: COLORS.white, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text, letterSpacing: -0.5 },
    searchRow: { flexDirection: 'row', gap: 12, padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    input: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.bg },
    searchBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
    searchBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
    filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.borderLight },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.borderLight, backgroundColor: COLORS.white },
    chipActive: { backgroundColor: COLORS.primaryBg, borderColor: COLORS.primary },
    chipText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    chipTextActive: { color: COLORS.primary, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    error: { margin: 20, color: COLORS.disputed, fontSize: 14, fontWeight: '500' },
    list: { padding: 20, paddingBottom: 40 },
    empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 15, fontWeight: '500' },
    hint: { textAlign: 'center', color: COLORS.textMuted, marginTop: 60, fontSize: 14, lineHeight: 22, paddingHorizontal: 40, fontWeight: '500' },
});