import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { CameraIcon, CarIcon } from '../../components/icons';
import { Badge, Body, Button, Card, ErrorBox, H1, H2, Label, ListRow, Screen } from '../../components/ui';
import { getActiveTrip, getCar, getTrips } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { colors, fonts } from '../../lib/theme';
import { fmtClock, fmtDay, fmtDuration, fmtTime } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';
import { useNow } from '../../lib/useNow';

export default function CarScreen() {
  const me = useMe();
  const now = useNow(1000);
  const { data, error, refreshing, refresh } = useLoad(async () => {
    const car = await getCar();
    const [active, mine] = await Promise.all([getActiveTrip(car.id), getTrips({ driverId: me.id, limit: 10 })]);
    return { car, active, mine };
  }, [me.id]);

  const active = data?.active ?? null;
  const mineActive = active?.driver_id === me.id;

  return (
    <Screen header={<BrandHeader />} refreshing={refreshing} onRefresh={refresh}>
      <H1>Office car</H1>
      {error && <ErrorBox message={error} />}

      {data && !mineActive && (
        <Card style={{ padding: 20, gap: 16 }}>
          <View style={styles.row}>
            <View style={styles.carIcon}>
              <CarIcon size={28} color={colors.maroon} />
            </View>
            <View style={{ flex: 1 }}>
              <H2>{data.car.name}</H2>
              {!!data.car.plate && <Body muted size={14}>{data.car.plate}</Body>}
            </View>
            <Badge text={active ? 'In use' : 'Available'} tone={active ? 'pending' : 'approved'} />
          </View>
          {active ? (
            <Body muted size={14}>
              {active.profiles?.full_name ?? 'Someone'} has had the car since {fmtTime(active.started_at)}.
            </Body>
          ) : (
            <>
              <Body muted size={14}>
                To start a trip, take a photo of the fuel gauge. You’ll take another one when you hand the car back.
              </Body>
              <Button
                title="Start trip"
                icon={<CameraIcon />}
                style={{ minHeight: 56 }}
                onPress={() => router.push({ pathname: '/fuel-photo', params: { mode: 'start', carId: String(data.car.id) } })}
              />
            </>
          )}
        </Card>
      )}

      {active && mineActive && (
        <View style={styles.activeCard}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Badge text="Trip in progress" tone="in" style={{ backgroundColor: '#FFFFFF' }} />
            <Text style={styles.onMaroon}>Started {fmtTime(active.started_at)}</Text>
          </View>
          <Text style={styles.timer}>{fmtClock(now - new Date(active.started_at).getTime())}</Text>
          {!!active.reason && <Text style={styles.onMaroon}>{active.reason}</Text>}
          <Button
            title="End trip"
            variant="light"
            icon={<CameraIcon color={colors.maroonDark} />}
            style={{ minHeight: 56 }}
            onPress={() => router.push({ pathname: '/fuel-photo', params: { mode: 'end', tripId: String(active.id) } })}
          />
        </View>
      )}

      <Card>
        <Label>My recent trips</Label>
        {data && data.mine.length === 0 && <Body muted size={14} style={{ marginTop: 10 }}>No trips yet.</Body>}
        {(data?.mine ?? []).map((t, i) => (
          <ListRow key={t.id} first={i === 0}>
            <View style={{ flex: 1, gap: 3 }}>
              <Body bold>
                {fmtDay(t.started_at)} · {fmtTime(t.started_at)} to {fmtTime(t.ended_at)}
              </Body>
              {!!t.reason && <Body muted size={14}>{t.reason}</Body>}
            </View>
            <Body bold size={14}>{fmtDuration(new Date(t.ended_at!).getTime() - new Date(t.started_at).getTime())}</Body>
          </ListRow>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  carIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.softRose, alignItems: 'center', justifyContent: 'center' },
  activeCard: { backgroundColor: colors.maroon, borderRadius: 16, padding: 20, gap: 16 },
  onMaroon: { fontFamily: fonts.body, fontSize: 14, color: '#EBD3D5' },
  timer: { fontFamily: fonts.display, fontSize: 52, color: '#FFFFFF', lineHeight: 58, fontVariant: ['tabular-nums'] },
});
