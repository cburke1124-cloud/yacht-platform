import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { listingsApi, messagesApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import { useFavoritesStore } from '@/store/favoritesStore';
import { useAuthStore } from '@/store/authStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function ImageCarousel({ images, title }: { images: { url: string; id: number }[]; title: string }) {
  const [index, setIndex] = useState(0);

  if (!images.length) {
    return (
      <View style={{ width: SCREEN_WIDTH, height: 320, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="boat-outline" size={56} color={Colors.mutedLight} />
      </View>
    );
  }

  return (
    <View style={{ height: 320 }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
        }
      >
        {images.map((img) => (
          <Image
            key={img.id}
            source={{ uri: img.url }}
            style={{ width: SCREEN_WIDTH, height: 320 }}
            contentFit="cover"
            accessibilityLabel={title}
          />
        ))}
      </ScrollView>
      {/* Dots */}
      {images.length > 1 && (
        <View style={{ position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', gap: 6 }}>
          {images.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 20 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? Colors.accent : 'rgba(255,255,255,0.6)',
              }}
            />
          ))}
        </View>
      )}
      {/* Counter */}
      <BlurView
        intensity={60}
        tint="dark"
        style={{ position: 'absolute', bottom: 12, right: 14, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4 }}
      >
        <Text style={{ color: Colors.white, fontFamily: 'Poppins_500Medium', fontSize: 12 }}>
          {index + 1} / {images.length}
        </Text>
      </BlurView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', paddingVertical: 12 }}>
      <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 16, color: Colors.primary }}>{value}</Text>
      <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.muted, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSaved, toggle } = useFavoritesStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [inquiryVisible, setInquiryVisible] = useState(false);
  const [inquiryText, setInquiryText] = useState('');

  const listingId = Number(id);

  const { data: listing, isLoading } = useQuery({
    queryKey: QueryKeys.listing(listingId),
    queryFn: () => listingsApi.getListing(listingId),
    enabled: !!listingId,
  });

  const inquiryMutation = useMutation({
    mutationFn: () =>
      listing
        ? messagesApi.startConversation(listing.id, listing.dealer_id, inquiryText)
        : Promise.reject('No listing'),
    onSuccess: (conversation) => {
      setInquiryVisible(false);
      setInquiryText('');
      queryClient.invalidateQueries({ queryKey: QueryKeys.conversations });
      router.push(`/conversation/${conversation.id}`);
    },
    onError: () => Alert.alert('Error', 'Failed to send inquiry. Please try again.'),
  });

  const handleToggleSave = async () => {
    if (!user) { router.push('/(auth)/login'); return; }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle(listingId);
  };

  const handleInquiry = () => {
    if (!user) { router.push('/(auth)/login'); return; }
    setInquiryText(`Hi, I'm interested in the ${listing?.title}. Is it still available?`);
    setInquiryVisible(true);
  };

  if (isLoading || !listing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  const sortedMedia = [...(listing.media ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <ScrollView bounces showsVerticalScrollIndicator={false}>
        {/* Photo carousel */}
        <ImageCarousel images={sortedMedia} title={listing.title} />

        {/* Back + Save overlay */}
        <View
          style={[StyleSheet.absoluteFill, { height: 56, top: insets.top, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="arrow-back" size={20} color={Colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleToggleSave}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons
              name={isSaved(listingId) ? 'heart' : 'heart-outline'}
              size={20}
              color={isSaved(listingId) ? '#F87171' : Colors.white}
            />
          </TouchableOpacity>
        </View>

        {/* Main info */}
        <View style={{ backgroundColor: Colors.white, padding: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 20, color: Colors.text, lineHeight: 26 }}>
                {listing.title}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Ionicons name="location-outline" size={13} color={Colors.muted} />
                <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.muted }}>
                  {listing.location}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 22, color: Colors.primary }}>
              ${listing.price.toLocaleString()}
            </Text>
          </View>

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 14,
              marginTop: 20,
              overflow: 'hidden',
            }}
          >
            <Stat label="Year" value={String(listing.year)} />
            <View style={{ width: 1, backgroundColor: Colors.border }} />
            <Stat label="Length" value={`${listing.length_ft} ft`} />
            <View style={{ width: 1, backgroundColor: Colors.border }} />
            <Stat label="Make" value={listing.make} />
            {listing.engine_hours !== undefined && (
              <>
                <View style={{ width: 1, backgroundColor: Colors.border }} />
                <Stat label="Hours" value={`${listing.engine_hours?.toLocaleString()}`} />
              </>
            )}
          </View>
        </View>

        {/* Description */}
        {listing.description && (
          <View style={{ backgroundColor: Colors.white, marginTop: 10, padding: 20 }}>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary, marginBottom: 10 }}>
              About this yacht
            </Text>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.textSecondary, lineHeight: 22 }}>
              {listing.description}
            </Text>
          </View>
        )}

        {/* Specifications */}
        <View style={{ backgroundColor: Colors.white, marginTop: 10, padding: 20 }}>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary, marginBottom: 14 }}>
            Specifications
          </Text>
          {[
            { label: 'Make', value: listing.make },
            { label: 'Model', value: listing.model },
            { label: 'Year', value: String(listing.year) },
            { label: 'Length', value: `${listing.length_ft} ft` },
            listing.beam_ft && { label: 'Beam', value: `${listing.beam_ft} ft` },
            listing.draft_ft && { label: 'Draft', value: `${listing.draft_ft} ft` },
            listing.hull_material && { label: 'Hull', value: listing.hull_material },
            listing.fuel_type && { label: 'Fuel', value: listing.fuel_type },
            listing.cabins && { label: 'Cabins', value: String(listing.cabins) },
            listing.engine_hours && { label: 'Engine Hours', value: listing.engine_hours.toLocaleString() },
          ]
            .filter(Boolean)
            .map((spec: any) => (
              <View
                key={spec.label}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight }}
              >
                <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted }}>{spec.label}</Text>
                <Text style={{ fontFamily: 'Poppins_500Medium', fontSize: 14, color: Colors.text }}>{spec.value}</Text>
              </View>
            ))}
        </View>

        {/* Dealer info */}
        {listing.dealer_name && (
          <View style={{ backgroundColor: Colors.white, marginTop: 10, padding: 20, marginBottom: 120 }}>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary, marginBottom: 12 }}>
              Listed by
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: Colors.white, fontFamily: 'Poppins_700Bold', fontSize: 18 }}>
                  {listing.dealer_name.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text }}>{listing.dealer_name}</Text>
                <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.muted }}>Verified Dealer</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: insets.bottom + 14,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <TouchableOpacity
          onPress={handleToggleSave}
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: Colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={isSaved(listingId) ? 'heart' : 'heart-outline'} size={22} color={isSaved(listingId) ? '#F87171' : Colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleInquiry}
          style={{ flex: 1, height: 52, backgroundColor: Colors.primary, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>
            Contact Dealer
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inquiry Modal */}
      <Modal visible={inquiryVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setInquiryVisible(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border }}>
            <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.primary }}>
              Contact Dealer
            </Text>
            <TouchableOpacity onPress={() => setInquiryVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted, marginBottom: 16 }}>
              Send a message about <Text style={{ fontFamily: 'Poppins_600SemiBold', color: Colors.text }}>{listing.title}</Text>
            </Text>
            <TextInput
              value={inquiryText}
              onChangeText={setInquiryText}
              multiline
              numberOfLines={6}
              style={{
                borderWidth: 1,
                borderColor: Colors.border,
                borderRadius: 12,
                padding: 14,
                fontFamily: 'Poppins_400Regular',
                fontSize: 15,
                color: Colors.text,
                textAlignVertical: 'top',
                minHeight: 140,
                backgroundColor: '#F9FAFB',
              }}
            />
            <TouchableOpacity
              onPress={() => inquiryMutation.mutate()}
              disabled={!inquiryText.trim() || inquiryMutation.isPending}
              style={{
                height: 52,
                backgroundColor: Colors.accent,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 16,
                opacity: inquiryMutation.isPending || !inquiryText.trim() ? 0.7 : 1,
              }}
            >
              {inquiryMutation.isPending ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>
                  Send Message
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
