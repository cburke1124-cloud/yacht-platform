import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function AuthLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#10214F' }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#10214F' } }} />
    </View>
  );
}
