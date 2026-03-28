import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants/colors';

// This file defines the bottom tab bar.
// Expo Router automatically shows tabs for files in the (tabs) folder.
// We show different tabs depending on whether the user is an owner or official.

export default function TabsLayout() {
    const { user } = useAuth();
    const isOfficial = user?.role === 'official' || user?.role === 'admin';

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textMuted,
                tabBarStyle: {
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 40 : 35,
                    left: 20,
                    right: 20,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: COLORS.white,
                    borderTopWidth: 0, // Remove standard top border
                    // Premium shadow for floating effect
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 12,
                    elevation: 8,
                    paddingBottom: 0, // Bottom padding not needed for floating
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                },
            }}
        >
            {/* Tab 1: My Lands — owners see this, officials don't need it */}
            <Tabs.Screen
                name="my-lands"
                options={{
                    title: 'My Land',
                    tabBarLabel: 'My Land',
                    // Hide this tab for officials
                    href: isOfficial ? null : '/(tabs)/my-lands',
                }}
            />

            {/* Tab 2: Search — only officials can search now */}
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Search',
                    tabBarLabel: 'Search',
                    // Hide this tab for owners
                    href: isOfficial ? '/(tabs)/search' : null,
                }}
            />

            {/* Tab 3: Official dashboard — only for officials and admins */}
            <Tabs.Screen
                name="official"
                options={{
                    title: 'Dashboard',
                    tabBarLabel: 'Dashboard',
                    // Hide this tab for regular owners
                    href: isOfficial ? '/(tabs)/official' : null,
                }}
            />

            {/* Explicitly hide any 'land' or '[id]' tab if it's phantom-discovered from parent routes */}
            <Tabs.Screen
                name="land/[id]"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}