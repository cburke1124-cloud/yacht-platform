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
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';

type Role = 'buyer' | 'dealer';
type Step = 1 | 2;

export default function RegisterScreen() {
  const { register } = useAuthStore();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>('buyer');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = () => {
    setStep(2);
  };

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? 'Registration failed. Please try again.';
      Alert.alert('Error', msg);
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
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Text style={{ fontSize: 30, fontFamily: 'Poppins_700Bold', color: Colors.white }}>
              Yacht<Text style={{ color: Colors.accent }}>Versal</Text>
            </Text>
          </View>

          {/* Step 1 — Role selection */}
          {step === 1 && (
            <View style={cardStyle}>
              <Text style={titleStyle}>Create account</Text>
              <Text style={subtitleStyle}>I'm joining as a…</Text>

              {(['buyer', 'dealer'] as Role[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => setRole(r)}
                  style={{
                    borderWidth: 2,
                    borderColor: role === r ? Colors.accent : Colors.border,
                    borderRadius: 14,
                    padding: 18,
                    marginBottom: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 14,
                    backgroundColor: role === r ? '#F0FBFD' : Colors.white,
                  }}
                >
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: role === r ? Colors.accent : '#F3F4F6',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons
                      name={r === 'buyer' ? 'search-outline' : 'briefcase-outline'}
                      size={22}
                      color={role === r ? Colors.white : Colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: Colors.text }}>
                      {r === 'buyer' ? 'Buyer' : 'Dealer / Broker'}
                    </Text>
                    <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 12, color: Colors.muted, marginTop: 2 }}>
                      {r === 'buyer'
                        ? 'Browse, save, and inquire about listings'
                        : 'List and manage yachts for sale'}
                    </Text>
                  </View>
                  {role === r && <Ionicons name="checkmark-circle" size={22} color={Colors.accent} />}
                </TouchableOpacity>
              ))}

              <TouchableOpacity onPress={handleNext} style={btnStyle}>
                <Text style={btnTextStyle}>Continue</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16 }}>
                <Text style={{ color: Colors.muted, fontFamily: 'Poppins_400Regular', fontSize: 14 }}>
                  Already have an account?{' '}
                </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text style={{ color: Colors.accent, fontFamily: 'Poppins_600SemiBold', fontSize: 14 }}>
                      Sign in
                    </Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          )}

          {/* Step 2 — Details */}
          {step === 2 && (
            <View style={cardStyle}>
              <TouchableOpacity onPress={() => setStep(1)} style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="arrow-back" size={18} color={Colors.muted} />
                <Text style={{ color: Colors.muted, fontFamily: 'Poppins_400Regular', fontSize: 13 }}>Back</Text>
              </TouchableOpacity>

              <Text style={titleStyle}>Your details</Text>
              <Text style={subtitleStyle}>Creating a {role} account</Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>First name</Text>
                  <TextInput value={firstName} onChangeText={setFirstName} style={inputStyle} placeholder="Jane" placeholderTextColor={Colors.mutedLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={labelStyle}>Last name</Text>
                  <TextInput value={lastName} onChangeText={setLastName} style={inputStyle} placeholder="Smith" placeholderTextColor={Colors.mutedLight} />
                </View>
              </View>

              <Text style={labelStyle}>Email address</Text>
              <TextInput value={email} onChangeText={setEmail} style={inputStyle} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" placeholderTextColor={Colors.mutedLight} />

              <Text style={labelStyle}>Password</Text>
              <TextInput value={password} onChangeText={setPassword} style={inputStyle} placeholder="Min. 8 characters" secureTextEntry placeholderTextColor={Colors.mutedLight} />

              <Text style={labelStyle}>Confirm password</Text>
              <TextInput value={confirm} onChangeText={setConfirm} style={inputStyle} placeholder="••••••••" secureTextEntry placeholderTextColor={Colors.mutedLight} />

              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }}
              >
                {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={btnTextStyle}>Create Account</Text>}
              </TouchableOpacity>

              <Text style={{ color: Colors.mutedLight, fontFamily: 'Poppins_400Regular', fontSize: 11, textAlign: 'center', marginTop: 14, lineHeight: 16 }}>
                By creating an account you agree to our Terms of Service and Privacy Policy.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const cardStyle = {
  backgroundColor: Colors.white,
  borderRadius: 20,
  padding: 28,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.25,
  shadowRadius: 20,
  elevation: 12,
} as const;

const titleStyle = {
  fontSize: 22,
  fontFamily: 'Poppins_600SemiBold',
  color: Colors.primary,
  marginBottom: 4,
} as const;

const subtitleStyle = {
  fontSize: 14,
  fontFamily: 'Poppins_400Regular',
  color: Colors.muted,
  marginBottom: 24,
} as const;

const labelStyle = {
  fontSize: 13,
  fontFamily: 'Poppins_500Medium',
  color: Colors.textSecondary,
  marginBottom: 6,
} as const;

const inputStyle = {
  borderWidth: 1,
  borderColor: '#E5E7EB',
  borderRadius: 10,
  height: 50,
  paddingHorizontal: 14,
  fontSize: 15,
  fontFamily: 'Poppins_400Regular',
  color: Colors.text,
  backgroundColor: '#F9FAFB',
  marginBottom: 16,
} as const;

const btnStyle = {
  backgroundColor: Colors.accent,
  borderRadius: 12,
  height: 52,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  marginTop: 8,
};

const btnTextStyle = {
  color: Colors.white,
  fontFamily: 'Poppins_600SemiBold',
  fontSize: 16,
} as const;
