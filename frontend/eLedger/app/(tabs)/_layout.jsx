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
                    borderTopWidth: 0.5,
                    borderTopColor: COLORS.border,
                    backgroundColor: COLORS.white,
                    height: 60,
                    paddingBottom: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
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

            {/* Tab 2: Search — everyone can search */}
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Search',
                    tabBarLabel: 'Search',
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
        </Tabs>
    );
}