export const COLORS = {
    // Brand 
    primary: '#2563EB',      // Vibrant Blue
    primaryBg: '#EFF6FF',
    accent: '#3B82F6',

    // Status (Modern HSL-derived)
    clear: '#15803D',       // Green
    clearBg: '#F0FDF4',
    clearBorder: '#BBF7D0',

    review: '#B45309',      // Amber
    reviewBg: '#FFFBEB',
    reviewBorder: '#FEF3C7',

    disputed: '#B91C1C',    // Red
    disputedBg: '#FEF2F2',
    disputedBorder: '#FECACA',

    // Neutral
    text: '#0F172A',        // Darkest slate
    textMuted: '#64748B',   // Muted slate
    border: '#E2E8F0',      // Light border
    borderLight: '#F1F5F9', // Very faint border
    bg: '#F8FAFC',          // Off-white background
    white: '#FFFFFF',

    dots: {
        original: '#10B981',
        sale: '#2563EB',
        inheritance: '#64748B',
        gift: '#8B5CF6',
        court_order: '#EF4444',
        govt_allotment: '#059669',
    },
};

export const STATUS_CONFIG = {
    clear: { label: 'Clear', color: COLORS.clear, bg: COLORS.clearBg, border: COLORS.clearBorder },
    under_review: { label: 'Under review', color: COLORS.review, bg: COLORS.reviewBg, border: COLORS.reviewBorder },
    disputed: { label: 'Disputed', color: COLORS.disputed, bg: COLORS.disputedBg, border: COLORS.disputedBorder },
};

export const TRANSFER_LABELS = {
    original: 'Original survey entry',
    sale: 'Sale / purchase',
    inheritance: 'Inheritance',
    gift: 'Gift deed',
    court_order: 'Court order',
    govt_allotment: 'Government allotment',
};