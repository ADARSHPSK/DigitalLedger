import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AuthContext stores the logged-in user across the whole app.
// Any screen can call useAuth() to get:
//   user       → { id, name, role }  or  null if not logged in
//   loading    → true while checking saved session on startup
//   saveSession(token, user) → call this after a successful login/register
//   logout()   → clears everything, sends user back to login

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true); // true while reading AsyncStorage

    // On app launch: reload any previously saved session
    useEffect(() => {
        (async () => {
            try {
                const savedToken = await AsyncStorage.getItem('token');
                const savedUser = await AsyncStorage.getItem('user');
                if (savedToken && savedUser) {
                    setUser(JSON.parse(savedUser));
                }
            } catch (e) {
                // If storage is corrupted, just start fresh
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Call this right after a successful login or register API call
    async function saveSession(token, userData) {
        await AsyncStorage.setItem('token', token);
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    }

    // Call this on logout — clears token and user from storage
    async function logout() {
        await AsyncStorage.removeItem('token');
        await AsyncStorage.removeItem('user');
        setUser(null);
    }

    return (
        <AuthContext.Provider value={{ user, loading, saveSession, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// Custom hook — use this in any screen:
//   const { user, logout } = useAuth();
export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}