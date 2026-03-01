import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/colors';

export default function LoginScreen() {
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Invalid email or password.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.primary }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo / Wordmark */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Text
              style={{
                fontSize: 36,
                fontFamily: 'Poppins_700Bold',
                color: Colors.white,
                letterSpacing: -0.5,
              }}
            >
              Yacht<Text style={{ color: Colors.accent }}>Versal</Text>
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Poppins_400Regular', fontSize: 14, marginTop: 4 }}>
              The premium yacht marketplace
            </Text>
          </View>

          {/* Form Card */}
          <View
            style={{
              backgroundColor: Colors.white,
              borderRadius: 20,
              padding: 28,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <Text style={{ fontSize: 22, fontFamily: 'Poppins_600SemiBold', color: Colors.primary, marginBottom: 4 }}>
              Welcome back
            </Text>
            <Text style={{ fontSize: 14, fontFamily: 'Poppins_400Regular', color: Colors.muted, marginBottom: 24 }}>
              Sign in to your account
            </Text>

            {/* Email */}
            <Text style={styles.label}>Email address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={styles.input}
              placeholderTextColor={Colors.mutedLight}
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              style={styles.input}
              placeholderTextColor={Colors.mutedLight}
              onSubmitEditing={handleLogin}
              returnKeyType="go"
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: Colors.accent,
                borderRadius: 12,
                height: 52,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Register link */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
              <Text style={{ color: Colors.muted, fontFamily: 'Poppins_400Regular', fontSize: 14 }}>
                Don't have an account?{' '}
              </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={{ color: Colors.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>
                    Create one
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = {
  label: {
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
    color: '#374151',
    marginBottom: 6,
  } as const,
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 50,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Poppins_400Regular',
    color: '#111827',
    backgroundColor: '#F9FAFB',
    marginBottom: 16,
  } as const,
};
