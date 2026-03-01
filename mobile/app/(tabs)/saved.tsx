import { View, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listingsApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import ListingCard from '@/components/ListingCard';
import { useAuthStore } from '@/store/authStore';

export default function SavedScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QueryKeys.saved,
    queryFn: listingsApi.getSaved,
    enabled: isAuthenticated,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.primary }}>
          Saved Listings
        </Text>
        {data && (
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.muted, marginTop: 2 }}>
            {data.length} {data.length === 1 ? 'yacht' : 'yachts'} saved
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlashList
          data={data ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/listing/${item.id}`)}
            />
          )}
          estimatedItemSize={280}
          contentContainerStyle={{ padding: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="heart-outline" size={56} color={Colors.mutedLight} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.muted, marginTop: 16 }}>
                No saved listings yet
              </Text>
              <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.mutedLight, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
                Tap the heart on any listing to save it for later
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
