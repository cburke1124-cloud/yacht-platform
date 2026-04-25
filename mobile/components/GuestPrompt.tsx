import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface GuestPromptProps {
  icon?: string;
  title?: string;
  message?: string;
}

export default function GuestPrompt({
  icon = 'lock-closed-outline',
  title = 'Sign in to continue',
  message = 'Create a free account to access this feature.',
}: GuestPromptProps) {
  const router = useRouter();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
      <Ionicons name={icon as any} size={60} color={Colors.mutedLight} />
      <Text style={{
        fontFamily: 'Poppins_600SemiBold',
        fontSize: 20,
        color: Colors.primary,
        marginTop: 20,
        textAlign: 'center',
      }}>
        {title}
      </Text>
      <Text style={{
        fontFamily: 'Poppins_400Regular',
        fontSize: 14,
        color: Colors.muted,
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 22,
      }}>
        {message}
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/login')}
        style={{
          backgroundColor: Colors.primary,
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 40,
          marginTop: 28,
        }}
      >
        <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>
          Sign In
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(auth)/register')}
        style={{ marginTop: 14 }}
      >
        <Text style={{ color: Colors.accent, fontFamily: 'Poppins_500Medium', fontSize: 14 }}>
          Create a free account
        </Text>
      </TouchableOpacity>
    </View>
  );
}
