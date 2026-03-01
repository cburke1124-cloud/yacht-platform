import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useAuthStore } from '@/store/authStore';
import * as Haptics from 'expo-haptics';
import type { Listing } from '@/types';

interface ListingCardProps {
  listing: Listing;
  onPress: () => void;
  compact?: boolean;
}

export default function ListingCard({ listing, onPress, compact = false }: ListingCardProps) {
  const { isSaved, toggle } = useFavoritesStore();
  const { isAuthenticated } = useAuthStore();

  const saved = isSaved(listing.id);

  const handleSave = async (e: any) => {
    e.stopPropagation?.();
    if (!isAuthenticated) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle(listing.id);
  };

  const imageHeight = compact ? 160 : 200;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={{
        backgroundColor: Colors.white,
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      {/* Image */}
      <View style={{ height: imageHeight, backgroundColor: '#F3F4F6' }}>
        {listing.primary_image_url ? (
          <Image
            source={{ uri: listing.primary_image_url }}
            style={{ width: '100%', height: imageHeight }}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="boat-outline" size={36} color={Colors.mutedLight} />
          </View>
        )}

        {/* Featured badge */}
        {listing.is_featured && (
          <View
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              backgroundColor: Colors.accent,
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 11 }}>
              Featured
            </Text>
          </View>
        )}

        {/* Save button */}
        {isAuthenticated && (
          <TouchableOpacity
            onPress={handleSave}
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons
              name={saved ? 'heart' : 'heart-outline'}
              size={17}
              color={saved ? '#F87171' : Colors.white}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Info */}
      <View style={{ padding: 12 }}>
        <Text
          style={{ fontFamily: 'Poppins_600SemiBold', fontSize: compact ? 14 : 15, color: Colors.text }}
          numberOfLines={1}
        >
          {listing.title}
        </Text>

        <Text
          style={{ fontFamily: 'Poppins_700Bold', fontSize: compact ? 16 : 18, color: Colors.primary, marginTop: 4 }}
        >
          ${listing.price.toLocaleString()}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="calendar-outline" size={12} color={Colors.muted} />
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted }}>
              {listing.year}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="resize-outline" size={12} color={Colors.muted} />
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted }}>
              {listing.length_ft} ft
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, flex: 1 }}>
            <Ionicons name="location-outline" size={12} color={Colors.muted} />
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted }} numberOfLines={1}>
              {listing.location}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}
