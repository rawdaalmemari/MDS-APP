import { router, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon, BellIcon } from '../components/icons';
import { Body, Card, ErrorBox, H1, Screen } from '../components/ui';
import { getNotifications, markAllRead, type Notification } from '../lib/api';
import { useAuth } from '../lib/auth';
import { colors, fonts } from '../lib/theme';
import { fmtDay, fmtTime } from '../lib/time';
import { useLoad } from '../lib/useLoad';

const clockKinds = ['clock_out_reminder', 'auto_clock_out', 'clock_in_reminder'];

export default function Inbox() {
  const { profile } = useAuth();
  const { data, error, refreshing, refresh } = useLoad(getNotifications);

  // Opening the inbox marks everything as read.
  useFocusEffect(
    useCallback(() => {
      markAllRead().catch(() => {});
      Notifications.setBadgeCountAsync(0).catch(() => {});
    }, []),
  );

  function open(n: Notification) {
    if (profile?.role === 'ceo') router.replace(n.kind === 'leave_request' ? '/(ceo)' : '/(ceo)/attendance');
    else router.replace(n.kind.startsWith('leave') ? '/(staff)/leave' : '/(staff)');
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <BackIcon />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <H1>Notifications</H1>
      {error && <ErrorBox message={error} />}
      {data && data.length === 0 && (
        <Card>
          <Body muted size={14}>Nothing here yet.</Body>
        </Card>
      )}
      {!!data?.length && (
        <Card style={{ paddingVertical: 0 }}>
          {data.map((n, i) => {
            const clock = clockKinds.includes(n.kind) || n.kind.startsWith('overtime');
            return (
              <Pressable key={n.id} accessibilityRole="button" onPress={() => open(n)} style={[styles.row, i === 0 && { borderTopWidth: 0 }]}>
                <View style={[styles.icon, { backgroundColor: clock ? colors.pendingBg : colors.softRose }]}>
                  <BellIcon size={20} color={clock ? colors.pendingFg : colors.maroon} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Body bold>{n.title}</Body>
                  <Body muted size={14}>{n.body}</Body>
                  <Body muted size={12}>
                    {fmtDay(n.created_at)}, {fmtTime(n.created_at)}
                  </Body>
                </View>
                {!n.read_at && <View accessibilityLabel="Unread" style={styles.dot} />}
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', marginTop: 8 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.maroon },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange, marginTop: 6 },
});
