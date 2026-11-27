import { Marcellus_400Regular } from '@expo-google-fonts/marcellus';
import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold } from '@expo-google-fonts/roboto';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Loading } from '../components/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import '../lib/location'; // registers the background geofence task
import { startOfficeGeofence } from '../lib/location';
import { registerForPush } from '../lib/push';
import { colors } from '../lib/theme';

function routeForNotification(kind: unknown, role: string | undefined) {
  switch (kind) {
    case 'leave_request':
    case 'overtime_request':
      return role === 'ceo' ? (kind === 'leave_request' ? '/(ceo)' : '/(ceo)/attendance') : '/notifications';
    case 'leave_decision':
      return '/(staff)/leave';
    case 'clock_in_reminder':
    case 'clock_out_reminder':
    case 'auto_clock_out':
      return '/(staff)';
    default:
      return '/notifications';
  }
}

function RootNavigator() {
  const { session, profile, loading } = useAuth();
  const lastResponse = Notifications.useLastNotificationResponse();

  // Once signed in: register this phone for push and start the office reminders (staff only).
  useEffect(() => {
    if (!profile) return;
    registerForPush().catch(() => {});
    if (profile.role === 'staff') startOfficeGeofence().catch(() => {});
  }, [profile]);

  // Open the right screen when someone taps a notification.
  useEffect(() => {
    if (!profile || !lastResponse) return;
    const kind = lastResponse.notification.request.content.data?.kind;
    router.push(routeForNotification(kind, profile.role) as never);
  }, [lastResponse, profile]);

  if (loading) return <Loading />;

  const signedIn = !!session && !!profile;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && profile?.role === 'staff'}>
        <Stack.Screen name="(staff)" />
        <Stack.Screen name="leave-request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="fuel-photo" options={{ presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && profile?.role === 'ceo'}>
        <Stack.Screen name="(ceo)" />
        <Stack.Screen name="trip/[id]" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="notifications" />
        <Stack.Screen name="account" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Marcellus_400Regular, Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  if (!fontsLoaded) return <Loading />;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
