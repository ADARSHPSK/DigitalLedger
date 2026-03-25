import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_CONFIG } from '../constants/colors';

// Props:
//   status  →  'clear' | 'under_review' | 'disputed'
//              (these are the exact strings the backend returns)
export default function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.clear;

    return (
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.text, { color: cfg.color }]}>
                {cfg.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 11,
        fontWeight: '600',
    },
});