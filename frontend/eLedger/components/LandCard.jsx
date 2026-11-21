import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '../constants/colors';
import StatusBadge from './StatusBadge';

// Props:
//   land        →  land object from the API
//   showOwner   →  show "Owner: X" in footer (true for official view)
//   onPress     →  optional override for tap — defaults to navigating to /land/:id
export default function LandCard({ land, showOwner = false, onPress }) {
    function handlePress() {
        if (onPress) {
            onPress(land);
        } else {
            router.push(`/land/${land._id}`);
        }
    }

    const commentCount = land.officialComments?.length || 0;

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={handlePress}
            activeOpacity={0.7}
        >
            {/* Top row: plot info + status badge */}
            <View style={styles.top}>
                <View style={styles.info}>
                    <Text style={styles.title} numberOfLines={1}>
                        Khasra #{land.khasraNo} — {land.village}
                    </Text>
                    <Text style={styles.meta}>
                        {land.areaValue} {land.areaUnit} · {land.landType}
                    </Text>
                    {showOwner && (
                        <Text style={styles.owner}>
                            {land.currentOwner}
                        </Text>
                    )}
                </View>
                <StatusBadge status={land.status} />
            </View>

            {/* Bottom row: extra info */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    {new Date(land.updatedAt).toLocaleDateString('en-IN')}
                </Text>
                {commentCount > 0 && (
                    <Text style={styles.footerText}>
                        {commentCount} official comment{commentCount !== 1 ? 's' : ''}
                    </Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.borderLight,
        // Subtle shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    top: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    info: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 4,
    },
    meta: {
        fontSize: 13,
        color: COLORS.textMuted,
        fontWeight: '500',
    },
    owner: {
        fontSize: 12,
        color: COLORS.primary,
        fontWeight: '600',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: COLORS.borderLight,
    },
    footerText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});