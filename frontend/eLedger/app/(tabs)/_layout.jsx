import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useAuth } from '../../lib/AuthContext';
import { COLORS } from '../../constants/colors';
import { Ionicons } from '@expo/vector-icons';

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

                tabBarShowLabel: false, // 🔥 remove labels for sleek look

                tabBarStyle: {
                    position: 'absolute',
                    bottom: Platform.OS === 'ios' ? 40 : 30,

                    marginHorizontal: 70,   // 🔥 smaller width
                    height: 52,             // 🔥 reduced height

                    borderRadius: 26,
                    backgroundColor: COLORS.white,
                    borderTopWidth: 0,

                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    elevation: 6,

                    fontSize: 9,
                    marginTop: -2,
                },

                tabBarItemStyle: {
                    justifyContent: 'center',
                    alignItems: 'center',
                },

                tabBarIconStyle: {
                    marginTop: 2, // keeps icon centered vertically
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
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'home' : 'home-outline'}
                            size={22}
                            color={color}
                        />
                    ),
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
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'search' : 'search-outline'}
                            size={22}
                            color={color}
                        />
                    ),
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
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'grid' : 'grid-outline'}
                            size={22}
                            color={color}
                        />
                    ),
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