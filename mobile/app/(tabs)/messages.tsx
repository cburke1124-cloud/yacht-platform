import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { messagesApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { Conversation } from '@/types';

dayjs.extend(relativeTime);

function ConversationRow({ item, onPress }: { item: Conversation; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
      }}
    >
      {/* Avatar */}
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: Colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {item.other_user_image ? (
          <Image source={{ uri: item.other_user_image }} style={{ width: 50, height: 50 }} />
        ) : (
          <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 18 }}>
            {item.other_user_name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text
            style={{
              fontFamily: item.unread_count > 0 ? 'Poppins_600SemiBold' : 'Poppins_500Medium',
              fontSize: 15,
              color: Colors.text,
            }}
            numberOfLines={1}
          >
            {item.other_user_name}
          </Text>
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.mutedLight }}>
            {item.last_message_at ? dayjs(item.last_message_at).fromNow() : ''}
          </Text>
        </View>

        {item.listing_title && (
          <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 11, color: Colors.accent, marginTop: 1 }} numberOfLines={1}>
            Re: {item.listing_title}
          </Text>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Text
            style={{
              flex: 1,
              fontFamily: item.unread_count > 0 ? 'Poppins_500Medium' : 'Poppins_400Regular',
              fontSize: 13,
              color: item.unread_count > 0 ? Colors.text : Colors.muted,
            }}
            numberOfLines={1}
          >
            {item.last_message ?? 'No messages yet'}
          </Text>
          {item.unread_count > 0 && (
            <View
              style={{
                backgroundColor: Colors.accent,
                borderRadius: 10,
                minWidth: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: 5,
                marginLeft: 8,
              }}
            >
              <Text style={{ color: Colors.white, fontSize: 11, fontFamily: 'Poppins_700Bold' }}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function MessagesScreen() {
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: QueryKeys.conversations,
    queryFn: messagesApi.getConversations,
    refetchInterval: 15_000,
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, backgroundColor: Colors.background }}>
        <Text style={{ fontFamily: 'Poppins_700Bold', fontSize: 24, color: Colors.primary }}>
          Messages
        </Text>
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
            <ConversationRow
              item={item}
              onPress={() => router.push(`/conversation/${item.id}`)}
            />
          )}
          estimatedItemSize={80}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 80 }}>
              <Ionicons name="chatbubbles-outline" size={56} color={Colors.mutedLight} />
              <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 18, color: Colors.muted, marginTop: 16 }}>
                No conversations yet
              </Text>
              <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.mutedLight, marginTop: 6, textAlign: 'center', paddingHorizontal: 32 }}>
                Message a dealer from any listing to start a conversation
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
