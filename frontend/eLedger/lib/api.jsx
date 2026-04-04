
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANT: Change BASE_URL when testing on a real phone.
//   Android emulator  →  'http://10.0.2.2:3000'
//   iOS simulator     →  'http://localhost:3000'
//   Real phone        →  'http://YOUR_COMPUTER_IP:3000'
const BASE_URL = 'http://192.168.1.9:5000';

// Every API call goes through this.
// Automatically attaches the saved JWT token to the Authorization header.
async function apiFetch(path, options = {}) {
    const token = await AsyncStorage.getItem('token');

    const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
    }

    return data;
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
// POST /auth/login  →  body: { phone, password }
export function login(phone, password) {
    return apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ phone, password }),
    });
}

// POST /auth/register  →  body: { name, phone, password }
export function register(name, phone, password) {
    return apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, phone, password }),
    });
}

// ── LAND — OWNER ──────────────────────────────────────────────────────────────
// GET /land/my/lands  →  returns array of owner's lands (summary)
export function getMyLands() {
    return apiFetch('/land/my/lands');
}

// GET /land/:id  →  full land with ownershipHistory[] and officialComments[]
export function getLand(id) {
    return apiFetch(`/land/${id}`);
}

// GET /land/search?q=...&status=...&village=...  (all optional)
export function searchLands({ q, status, village } = {}) {
    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (status) params.append('status', status);
    if (village) params.append('village', village);
    const qs = params.toString();
    return apiFetch(`/land/search${qs ? `?${qs}` : ''}`);
}

// ── LAND — OFFICIAL ───────────────────────────────────────────────────────────
// GET /land/official/flagged  →  all disputed + under_review lands
export function getFlaggedLands() {
    return apiFetch('/land/official/flagged');
}

// POST /land/:id/comment  →  body: { text, tag? }
export function addComment(landId, text, tag) {
    return apiFetch(`/land/${landId}/comment`, {
        method: 'POST',
        body: JSON.stringify({ text, ...(tag ? { tag } : {}) }),
    });
}

// PATCH /land/:id/status  →  body: { status }
export function updateStatus(landId, status) {
    return apiFetch(`/land/${landId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

// POST /land/:id/transfer  →  body: { ownerName, transferType, date, documentRef, notes }
export function addTransfer(landId, data) {
    return apiFetch(`/land/${landId}/transfer`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}
