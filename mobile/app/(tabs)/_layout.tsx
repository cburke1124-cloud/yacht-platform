import { Tabs } from 'expo-router';
import { View, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { messagesApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useEffect } from 'react';

function TabBadge({ count }: { count: number }) {
  if (count < 1) return null;
  return (
    <View
      style={{
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: Colors.danger,
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 3,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 10, fontFamily: 'Poppins_700Bold' }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const { load: loadFavorites } = useFavoritesStore();
  const isDealer = user?.role === 'dealer' || user?.role === 'admin';

  const { data: unreadCount = 0 } = useQuery({
    queryKey: QueryKeys.unreadCount,
    queryFn: messagesApi.getUnreadCount,
    refetchInterval: 30_000,
    enabled: !!user,
  });

  useEffect(() => {
    if (user) loadFavorites();
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.mutedLight,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.borderLight,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: 'Poppins_500Medium',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubble-outline" size={size} color={color} />
              <TabBadge count={unreadCount} />
            </View>
          ),
        }}
      />
      {isDealer && (
        <Tabs.Screen
          name="manage"
          options={{
            title: 'My Listings',
            tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} />,
          }}
        />
      )}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
      {/* Hide manage tab for buyers */}
      {!isDealer && (
        <Tabs.Screen
          name="manage"
          options={{ href: null }}
        />
      )}
    </Tabs>
  );
}
