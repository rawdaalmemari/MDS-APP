import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { getUnreadCount } from './api';

export function useUnread() {
  const [count, setCount] = useState(0);
  const load = useCallback(() => {
    getUnreadCount().then(setCount).catch(() => {});
  }, []);
  useFocusEffect(load);
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(load);
    return () => sub.remove();
  }, [load]);
  return count;
}
