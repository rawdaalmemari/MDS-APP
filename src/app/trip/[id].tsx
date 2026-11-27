import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BackIcon } from '../../components/icons';
import { Avatar, Body, Card, ErrorBox, H1, Label, Screen } from '../../components/ui';
import { getTrip, photoUrl } from '../../lib/api';
import { colors, fonts } from '../../lib/theme';
import { fmtDay, fmtDuration, fmtTime, initials } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(async () => {
    const trip = await getTrip(Number(id));
    const [start, end] = await Promise.all([photoUrl(trip.start_photo), trip.end_photo ? photoUrl(trip.end_photo) : null]);
    return { trip, start, end };
  }, [id]);
  const t = data?.trip;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <BackIcon />
        <Text style={styles.backText}>Car log</Text>
      </Pressable>
      {error && <ErrorBox message={error} />}
      {t && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar text={initials(t.profiles?.full_name ?? '?')} size={48} />
            <View>
              <H1 style={{ fontSize: 24 }}>{t.profiles?.full_name}</H1>
              <Body muted size={14}>{fmtDay(t.started_at)}</Body>
            </View>
          </View>
          <Card style={{ flexDirection: 'row' }}>
            {[
              ['Start', fmtTime(t.started_at)],
              ['End', t.ended_at ? fmtTime(t.ended_at) : 'Driving'],
              ['Duration', t.ended_at ? fmtDuration(new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) : '…'],
            ].map(([k, v]) => (
              <View key={k} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Label>{k}</Label>
                <Text style={styles.stat}>{v}</Text>
              </View>
            ))}
          </Card>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              ['Start photo', data!.start, t.started_at],
              ['End photo', data!.end, t.ended_at],
            ].map(([label, url, at]) => (
              <View key={label as string} style={{ flex: 1, gap: 6 }}>
                <View style={styles.photo}>
                  {url ? (
                    <Image source={{ uri: url as string }} style={StyleSheet.absoluteFill} accessibilityLabel={`${label} of the fuel gauge`} />
                  ) : (
                    <Text style={styles.noPhoto}>No photo yet</Text>
                  )}
                </View>
                <Body muted size={13}>
                  {label as string}
                  {at ? ` · ${fmtTime(at as string)}` : ''}
                </Body>
              </View>
            ))}
          </View>
          {!!t.reason && (
            <Card>
              <Label>Reason</Label>
              <Body style={{ marginTop: 6 }}>{t.reason}</Body>
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', marginTop: 8 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.maroon },
  stat: { fontFamily: fonts.bold, fontSize: 18, color: colors.plum },
  photo: { aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#241D22', alignItems: 'center', justifyContent: 'center' },
  noPhoto: { fontFamily: fonts.body, color: '#CDBFC5', fontSize: 13 },
});
