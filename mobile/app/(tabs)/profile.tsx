import { View, Text, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { Colors } from '@/constants/colors';

function ProfileRow({
  icon,
  label,
  value,
  onPress,
  danger,
  toggle,
  toggleValue,
  onToggle,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
        gap: 12,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: danger ? '#FEF2F2' : '#F0FBFD',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon as any} size={18} color={danger ? Colors.danger : Colors.accent} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: 'Poppins_500Medium',
          fontSize: 15,
          color: danger ? Colors.danger : Colors.text,
        }}
      >
        {label}
      </Text>
      {value && (
        <Text style={{ fontFamily: 'Poppins_400Regular', fontSize: 13, color: Colors.muted }}>
          {value}
        </Text>
      )}
      {toggle !== undefined ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: Colors.border, true: Colors.accent }}
          thumbColor={Colors.white}
        />
      ) : (
        onPress && <Ionicons name="chevron-forward-outline" size={16} color={Colors.mutedLight} />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const roleLabel = user?.role === 'dealer' ? 'Dealer' : user?.role === 'admin' ? 'Admin' : 'Buyer';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top']}>
      <ScrollView>
        {/* Profile header */}
        <View
          style={{
            backgroundColor: Colors.primary,
            paddingHorizontal: 20,
            paddingTop: 20,
            paddingBottom: 32,
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: Colors.accent,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: Colors.white, fontFamily: 'Poppins_700Bold', fontSize: 28 }}>
              {user?.first_name?.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <Text style={{ color: Colors.white, fontFamily: 'Poppins_700Bold', fontSize: 20 }}>
            {user?.first_name} {user?.last_name}
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Poppins_400Regular', fontSize: 14, marginTop: 2 }}>
            {user?.email}
          </Text>
          <View
            style={{
              marginTop: 10,
              backgroundColor: Colors.accent,
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 4,
            }}
          >
            <Text style={{ color: Colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 12 }}>
              {roleLabel}
            </Text>
          </View>
        </View>

        {/* Account section */}
        <View style={{ marginTop: 20, marginHorizontal: 16 }}>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: Colors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Account
          </Text>
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <ProfileRow icon="person-outline" label="Edit Profile" onPress={() => Alert.alert('Coming soon')} />
            <ProfileRow icon="lock-closed-outline" label="Change Password" onPress={() => Alert.alert('Coming soon')} />
            <ProfileRow icon="notifications-outline" label="Notifications" onPress={() => Alert.alert('Coming soon')} />
          </View>
        </View>

        {/* Support section */}
        <View style={{ marginTop: 20, marginHorizontal: 16 }}>
          <Text style={{ fontFamily: 'Poppins_600SemiBold', fontSize: 13, color: Colors.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Support
          </Text>
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <ProfileRow icon="help-circle-outline" label="Help Center" onPress={() => Alert.alert('Coming soon')} />
            <ProfileRow icon="document-text-outline" label="Terms of Service" onPress={() => Alert.alert('Coming soon')} />
            <ProfileRow icon="shield-outline" label="Privacy Policy" onPress={() => Alert.alert('Coming soon')} />
          </View>
        </View>

        {/* Sign out */}
        <View style={{ marginTop: 20, marginHorizontal: 16, marginBottom: 32 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <ProfileRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} danger />
          </View>
        </View>

        <Text style={{ textAlign: 'center', color: Colors.mutedLight, fontFamily: 'Poppins_400Regular', fontSize: 12, marginBottom: 24 }}>
          YachtVersal v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
