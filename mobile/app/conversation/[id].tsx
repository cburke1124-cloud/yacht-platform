import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { messagesApi } from '@/lib/api';
import { QueryKeys } from '@/lib/queryKeys';
import { Colors } from '@/constants/colors';
import { useAuthStore } from '@/store/authStore';
import dayjs from 'dayjs';
import type { Message } from '@/types';

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  return (
    <View
      style={{
        alignItems: isOwn ? 'flex-end' : 'flex-start',
        marginVertical: 3,
        paddingHorizontal: 16,
      }}
    >
      <View
        style={{
          maxWidth: '80%',
          backgroundColor: isOwn ? Colors.primary : Colors.white,
          borderRadius: 16,
          borderBottomRightRadius: isOwn ? 4 : 16,
          borderBottomLeftRadius: isOwn ? 16 : 4,
          paddingHorizontal: 14,
          paddingVertical: 10,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 1,
        }}
      >
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 15,
            color: isOwn ? Colors.white : Colors.text,
            lineHeight: 22,
          }}
        >
          {message.body}
        </Text>
        <Text
          style={{
            fontFamily: 'Poppins_400Regular',
            fontSize: 10,
            color: isOwn ? 'rgba(255,255,255,0.55)' : Colors.mutedLight,
            marginTop: 4,
            alignSelf: 'flex-end',
          }}
        >
          {dayjs(message.created_at).format('h:mm A')}
        </Text>
      </View>
    </View>
  );
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const conversationId = Number(id);

  const { data, isLoading } = useQuery({
    queryKey: QueryKeys.messages(conversationId),
    queryFn: () => messagesApi.getMessages(conversationId),
    refetchInterval: 5_000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) => messagesApi.sendMessage(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QueryKeys.messages(conversationId) });
      queryClient.invalidateQueries({ queryKey: QueryKeys.conversations });
      setText('');
    },
  });

  // Mark as read
  useEffect(() => {
    messagesApi.markRead(conversationId).catch(() => {});
    queryClient.invalidateQueries({ queryKey: QueryKeys.unreadCount });
  }, [conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (data?.messages?.length) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [data?.messages?.length]);

  const messages = data?.messages ?? [];

  const handleSend = () => {
    const body = text.trim();
    if (!body) return;
    sendMutation.mutate(body);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      {/* Nav bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: Colors.white,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border,
          gap: 10,
        }}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 16, color: Colors.primary }} numberOfLines={1}>
            Conversation
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <MessageBubble message={item} isOwn={item.sender_id === user?.id} />
            )}
            contentContainerStyle={{ paddingVertical: 12 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 60 }}>
                <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 14, color: Colors.muted }}>
                  No messages yet. Start the conversation!
                </Text>
              </View>
            }
          />
        )}

        {/* Input bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            paddingBottom: 10 + (Platform.OS === 'ios' ? 0 : insets.bottom),
            backgroundColor: Colors.white,
            borderTopWidth: 1,
            borderTopColor: Colors.border,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message…"
            placeholderTextColor={Colors.mutedLight}
            multiline
            style={{
              flex: 1,
              maxHeight: 120,
              minHeight: 44,
              borderWidth: 1,
              borderColor: Colors.border,
              borderRadius: 22,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontFamily: 'Poppins_400Regular',
              fontSize: 15,
              color: Colors.text,
              backgroundColor: '#F9FAFB',
            }}
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sendMutation.isPending}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: text.trim() ? Colors.accent : Colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
