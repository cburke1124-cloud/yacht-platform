import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';

// NativeWind web requires class-based dark mode
if (Platform.OS === 'web') {
  (StyleSheet as any).setFlag?.('darkMode', 'class');
}
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { useAuthStore } from '@/store/authStore';
import { StatusBar } from 'expo-status-bar';
import '../global.css';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function AuthGate() {
  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading, hydrateFromCache } = useAuthStore();

  useEffect(() => {
    hydrateFromCache();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    // Routes that strictly require authentication
    const inStrictProtectedRoute =
      segments[0] === 'conversation' || segments[0] === 'listing-editor';

    if (!isAuthenticated && !inAuthGroup && inStrictProtectedRoute) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  // On web, font loading can stall — render after 2s regardless
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (fontsLoaded || timedOut) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, timedOut]);

  if (!fontsLoaded && !timedOut) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AuthGate />
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="listing/[id]"
                options={{ presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="conversation/[id]"
                options={{ presentation: 'card', animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="listing-editor/[id]"
                options={{ presentation: 'card', animation: 'slide_from_right' }}
              />
            </Stack>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
