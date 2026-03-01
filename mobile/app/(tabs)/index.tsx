import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { listingsApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import ListingCard from '@/components/ListingCard';
import FilterSheet from '@/components/FilterSheet';
import type { ListingFilters, Listing } from '@/types';

export default function BrowseScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [committed, setCommitted] = useState('');
  const [filters, setFilters] = useState<ListingFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const activeFilters: ListingFilters = { ...filters, search: committed || undefined, page };

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QueryKeys.listings(activeFilters),
    queryFn: () => listingsApi.getListings(activeFilters),
    placeholderData: (prev) => prev,
  });

  const { data: featured } = useQuery({
    queryKey: QueryKeys.featured,
    queryFn: listingsApi.getFeatured,
    staleTime: 1000 * 60 * 5,
  });

  const handleSearch = () => setCommitted(search);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== undefined && v !== '',
  ).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ backgroundColor: Colors.primary, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 }}>
        <Text style={{ color: Colors.white, fontFamily: 'Poppins_700Bold', fontSize: 22, marginBottom: 12 }}>
          Yacht<Text style={{ color: Colors.accent }}>Versal</Text>
        </Text>

        {/* Search bar */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: Colors.white,
              borderRadius: 12,
              paddingHorizontal: 12,
              gap: 8,
              height: 46,
            }}
          >
            <Ionicons name="search-outline" size={18} color={Colors.muted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search yachts, make, location…"
              placeholderTextColor={Colors.mutedLight}
              style={{ flex: 1, fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.text }}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { setSearch(''); setCommitted(''); }}>
                <Ionicons name="close-circle" size={18} color={Colors.mutedLight} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            style={{
              width: 46,
              height: 46,
              backgroundColor: activeFilterCount > 0 ? Colors.accent : 'rgba(255,255,255,0.15)',
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="options-outline" size={20} color={Colors.white} />
            {activeFilterCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: Colors.white,
                }}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {isLoading && !data ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlashList
          data={data?.listings ?? []}
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
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.accent}
            />
          }
          ListHeaderComponent={
            committed || activeFilterCount > 0 ? null : featured && featured.length > 0 ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary, marginBottom: 12 }}>
                  Featured Listings
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }}>
                  {featured.slice(0, 6).map((listing) => (
                    <View key={listing.id} style={{ width: 260, marginHorizontal: 6 }}>
                      <ListingCard
                        listing={listing}
                        onPress={() => router.push(`/listing/${listing.id}`)}
                        compact
                      />
                    </View>
                  ))}
                </ScrollView>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary, marginTop: 20, marginBottom: 4 }}>
                  All Listings
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Ionicons name="boat-outline" size={48} color={Colors.mutedLight} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.muted, marginTop: 16 }}>
                No listings found
              </Text>
              <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.mutedLight, marginTop: 4 }}>
                Try adjusting your search or filters
              </Text>
            </View>
          }
          ListFooterComponent={
            data && data.page < data.pages ? (
              <TouchableOpacity
                onPress={() => setPage((p) => p + 1)}
                style={{
                  margin: 16,
                  padding: 14,
                  backgroundColor: Colors.primary,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>
                  Load more
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <FilterSheet
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onApply={(f) => { setFilters(f); setPage(1); setShowFilters(false); }}
      />
    </SafeAreaView>
  );
}
