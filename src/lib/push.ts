import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { setPushToken } from './api';
import { colors } from './theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const REMINDER_CATEGORY = 'clock-reminder';

/** Asks for notification permission and saves this phone's Expo push token on the profile. */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Munazuri',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: colors.maroon,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
  if (!granted || !Device.isDevice) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // set after `eas init`
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await setPushToken(token);
  return token;
}

/** Shows a notification on this phone right away (used by the location reminders). */
export async function showLocalNotification(title: string, body: string, data: Record<string, unknown> = {}) {
  await Notifications.scheduleNotificationAsync({ content: { title, body, data, sound: 'default' }, trigger: null });
}
