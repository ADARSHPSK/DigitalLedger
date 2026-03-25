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
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 0.5,
        borderColor: COLORS.border,
    },
    top: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
    },
    info: {
        flex: 1,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 3,
    },
    meta: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    owner: {
        fontSize: 12,
        color: COLORS.textMuted,
        marginTop: 2,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 0.5,
        borderColor: COLORS.borderLight,
    },
    footerText: {
        fontSize: 12,
        color: '#999',
    },
});