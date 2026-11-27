import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { ChevronIcon } from '../../components/icons';
import { Avatar, Body, Card, ErrorBox, H1, Screen } from '../../components/ui';
import { getActiveTrip, getCar, getTrips } from '../../lib/api';
import { colors, fonts } from '../../lib/theme';
import { fmtClock, fmtDay, fmtDuration, fmtTime, initials } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';
import { useNow } from '../../lib/useNow';

export default function CarLog() {
  const now = useNow(1000);
  const { data, error, refreshing, refresh } = useLoad(async () => {
    const car = await getCar();
    const [active, trips] = await Promise.all([getActiveTrip(car.id), getTrips({ limit: 100 })]);
    return { active, trips };
  });
  const active = data?.active ?? null;

  return (
    <Screen header={<BrandHeader />} refreshing={refreshing} onRefresh={refresh}>
      <H1>Car log</H1>
      {error && <ErrorBox message={error} />}
      {active && (
        <View style={styles.active}>
          <Avatar text={initials(active.profiles?.full_name ?? '?')} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.activeName}>{active.profiles?.full_name} is driving</Text>
            <Text style={styles.activeSub}>
              Since {fmtTime(active.started_at)}
              {active.reason ? ` · ${active.reason}` : ''}
            </Text>
          </View>
          <Text style={styles.activeTimer}>{fmtClock(now - new Date(active.started_at).getTime())}</Text>
        </View>
      )}
      <Card style={{ paddingVertical: 0 }}>
        {data && data.trips.length === 0 && <Body muted size={14} style={{ paddingVertical: 14 }}>No trips yet.</Body>}
        {(data?.trips ?? []).map((t, i) => (
          <Pressable
            key={t.id}
            accessibilityRole="button"
            accessibilityLabel={`Trip by ${t.profiles?.full_name} on ${fmtDay(t.started_at)}`}
            onPress={() => router.push({ pathname: '/trip/[id]', params: { id: String(t.id) } })}
            style={[styles.row, i === 0 && { borderTopWidth: 0 }]}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Body bold>{t.profiles?.full_name}</Body>
              <Body muted size={13}>
                {fmtDay(t.started_at)} · {fmtTime(t.started_at)} to {fmtTime(t.ended_at)}
              </Body>
            </View>
            <Body bold size={14}>{fmtDuration(new Date(t.ended_at!).getTime() - new Date(t.started_at).getTime())}</Body>
            <ChevronIcon />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  active: { backgroundColor: colors.maroon, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeName: { fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF' },
  activeSub: { fontFamily: fonts.body, fontSize: 14, color: '#EBD3D5' },
  activeTimer: { fontFamily: fonts.display, fontSize: 18, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.divider, minHeight: 56 },
});
