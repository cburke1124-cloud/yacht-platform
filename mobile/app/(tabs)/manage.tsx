import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { dealerApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import { Image } from 'expo-image';
import type { Listing } from '@/types';

const STATUS_TABS = ['all', 'active', 'draft', 'sold'] as const;
type StatusTab = typeof STATUS_TABS[number];

function ManageListingCard({ listing, onEdit, onDelete }: { listing: Listing; onEdit: () => void; onDelete: () => void }) {
  const statusColor = listing.status === 'active' ? Colors.success : listing.status === 'sold' ? Colors.muted : Colors.warning;

  return (
    <View
      style={{
        backgroundColor: Colors.white,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
      }}
    >
      {/* Image */}
      <View style={{ height: 140 }}>
        {listing.primary_image_url ? (
          <Image source={{ uri: listing.primary_image_url }} style={{ width: '100%', height: 140 }} contentFit="cover" />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="boat-outline" size={36} color={Colors.mutedLight} />
          </View>
        )}
        {/* Status badge */}
        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: statusColor, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
          <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 11, textTransform: 'capitalize' }}>
            {listing.status}
          </Text>
        </View>
      </View>

      {/* Info */}
      <View style={{ padding: 12 }}>
        <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text }} numberOfLines={1}>
          {listing.title}
        </Text>
        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 17, color: Colors.primary, marginTop: 4 }}>
          ${listing.price.toLocaleString()}
        </Text>
        <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted, marginTop: 2 }}>
          {listing.year} · {listing.length_ft}ft · {listing.location}
        </Text>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <TouchableOpacity
            onPress={onEdit}
            style={{
              flex: 1,
              height: 38,
              backgroundColor: Colors.background,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: Colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 4,
            }}
          >
            <Ionicons name="create-outline" size={15} color={Colors.text} />
            <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 13, color: Colors.text }}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={{
              width: 38,
              height: 38,
              backgroundColor: '#FEF2F2',
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function ManageScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [statusTab, setStatusTab] = useState<StatusTab>('all');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QueryKeys.myListings(1, statusTab === 'all' ? undefined : statusTab),
    queryFn: () => dealerApi.getMyListings(1, statusTab === 'all' ? undefined : statusTab),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => dealerApi.deleteListing(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['listings', 'my'] }),
  });

  const handleDelete = (id: number, title: string) => {
    Alert.alert('Delete Listing', `Delete "${title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate(id) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.primary }}>My Listings</Text>
        <TouchableOpacity
          onPress={() => Alert.alert('Coming soon', 'Listing creation form is in progress.')}
          style={{ backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="add" size={18} color={Colors.white} />
          <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Status tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 }}>
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setStatusTab(tab)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 6,
              borderRadius: 20,
              backgroundColor: statusTab === tab ? Colors.primary : Colors.white,
              borderWidth: 1,
              borderColor: statusTab === tab ? Colors.primary : Colors.border,
            }}
          >
            <Text
              style={{
                fontFamily: 'Poppins_500Medium',
                fontSize: 13,
                color: statusTab === tab ? Colors.white : Colors.muted,
                textTransform: 'capitalize',
              }}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlashList
          data={data?.listings ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ManageListingCard
              listing={item}
              onEdit={() => Alert.alert('Coming soon')}
              onDelete={() => handleDelete(item.id, item.title)}
            />
          )}
          estimatedItemSize={260}
          numColumns={1}
          contentContainerStyle={{ padding: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="briefcase-outline" size={56} color={Colors.mutedLight} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.muted, marginTop: 16 }}>
                No listings yet
              </Text>
              <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.mutedLight, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
                Tap + New to create your first listing
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
