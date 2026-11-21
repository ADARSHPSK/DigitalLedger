import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { AuthProvider, useAuth } from '../lib/AuthContext';

// This component reads the auth state and redirects accordingly.
// It runs every time the app opens.
function RootNavigator() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // wait for AsyncStorage to load saved session

    if (!user) {
      // Not logged in → go to login screen
      router.replace('/');
    } else if (user.role === 'official' || user.role === 'admin') {
      // Official/admin → go to official dashboard
      router.replace('/(tabs)/official');
    } else {
      // Owner → go to my lands
      router.replace('/(tabs)/my-lands');
    }
  }, [user, loading]);

  // Stack holds all screens.
  // headerShown: false because each screen draws its own header.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register/index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="land/[id]" />
    </Stack>
  );
}

// AuthProvider wraps everything so every screen can call useAuth()
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}