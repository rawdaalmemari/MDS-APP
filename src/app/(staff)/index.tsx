import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { ClockIcon, PinIcon, ShieldIcon } from '../../components/icons';
import { Badge, Body, Button, Card, ErrorBox, H1, Label, ListRow, Screen } from '../../components/ui';
import { clockIn, clockOut, friendlyError, getMyShiftsSince, getSettings, type Shift } from '../../lib/api';
import { useMe } from '../../lib/auth';
import { getPosition } from '../../lib/location';
import { colors, fonts } from '../../lib/theme';
import { dubaiParts, firstName, fmtDay, fmtMinutes, fmtTime, greeting, todayLabel } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';
import { useNow } from '../../lib/useNow';

function weekStartIso() {
  const { isoDow } = dubaiParts();
  const d = new Date(Date.now() - (isoDow - 1) * 86400000);
  return new Date(`${d.toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' })}T00:00:00+04:00`).toISOString();
}

function workedMin(s: Shift, now: number) {
  const end = s.clock_out_at ? new Date(s.clock_out_at).getTime() : now;
  return Math.max(0, Math.round((end - new Date(s.clock_in_at).getTime()) / 60000));
}

export default function ClockScreen() {
  const me = useMe();
  const now = useNow(30000);
  const { data, error: loadError, refreshing, refresh, reload } = useLoad(async () => {
    const [settings, week] = await Promise.all([getSettings(), getMyShiftsSince(me.id, weekStartIso())]);
    return { settings, week };
  }, [me.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const week = data?.week ?? [];
  const open = week.find((s) => !s.clock_out_at) ?? null;
  const friday = data ? data.settings.no_auto_clockout_days.includes(dubaiParts().isoDow) : false;
  const today = dubaiParts().date;
  const todays = week.filter((s) => new Date(s.clock_in_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }) === today);
  const events = todays
    .flatMap((sh) => {
      const list: { key: string; at: string; label: string; tone: 'in' | 'neutral' | 'pending'; where: string }[] = [
        { key: `${sh.id}-in`, at: sh.clock_in_at, label: 'Clock in', tone: 'in', where: `At the studio · ${sh.clock_in_distance_m} m` },
      ];
      if (sh.clock_out_at)
        list.push(
          sh.clock_out_method === 'auto'
            ? { key: `${sh.id}-out`, at: sh.clock_out_at, label: 'Auto clock-out', tone: 'pending', where: 'Left the studio area' }
            : { key: `${sh.id}-out`, at: sh.clock_out_at, label: 'Clock out', tone: 'neutral', where: `At the studio · ${sh.clock_out_distance_m} m` },
        );
      return list;
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  const weekTotal = week.reduce((a, s) => a + workedMin(s, now), 0);

  async function onPress() {
    setBusy(true);
    setError(null);
    try {
      const pos = await getPosition();
      if (open) await clockOut(pos.lat, pos.lng);
      else await clockIn(pos.lat, pos.lng);
      await reload();
    } catch (e) {
      const msg = friendlyError(e);
      setError(
        open && msg.startsWith('You’re')
          ? `${msg} ${friday ? 'Clock out when you’re back from prayer.' : 'If you’ve left for the day, you’ll be clocked out automatically at the time you left.'}`
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen header={<BrandHeader />} refreshing={refreshing} onRefresh={refresh}>
      <View>
        <Body muted size={14}>{todayLabel()}</Body>
        <H1>{greeting()}, {firstName(me.full_name)}</H1>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Badge text={open ? 'Clocked in' : 'Not clocked in'} tone={open ? 'in' : 'dark'} style={!open && { backgroundColor: colors.text2 }} />
          <Text style={styles.heroTz}>Asia/Dubai</Text>
        </View>
        <View>
          <Text style={styles.heroTime}>{fmtTime(new Date(now))}</Text>
          <Text style={styles.heroSub}>
            {open
              ? `Since ${fmtTime(open.clock_in_at)} at the studio`
              : 'Office hours 9:00 AM to 5:30 PM. Tap when you arrive.'}
          </Text>
        </View>
        {error && <ErrorBox message={error} />}
        <Button
          title={busy ? 'Checking your location…' : open ? 'Clock out' : 'Clock in'}
          variant={open ? 'light' : 'accent'}
          onPress={onPress}
          loading={busy}
          icon={<ClockIcon size={20} color={colors.plum} />}
          style={{ minHeight: 56 }}
        />
        <View style={styles.heroLine}>
          <PinIcon />
          <Text style={styles.heroLineText}>Clock in and out only work within 150 m of the studio</Text>
        </View>
        <View style={styles.heroLine}>
          <ShieldIcon />
          <Text style={styles.heroLineText}>
            {friday ? 'Friday: no automatic clock-out, for Juma prayer' : 'Auto clock-out if you leave the area for 15 min'}
          </Text>
        </View>
      </View>

      {loadError && <ErrorBox message={loadError} />}

      <Card>
        <Label>Today</Label>
        {events.length === 0 && <Body muted size={14} style={{ marginTop: 10 }}>No clock-ins yet today.</Body>}
        {events.map((ev, i) => (
          <ListRow key={ev.key} first={i === 0}>
            <Badge text={ev.label} tone={ev.tone} />
            <Body muted size={14} style={{ flex: 1 }}>{ev.where}</Body>
            <Body bold>{fmtTime(ev.at)}</Body>
          </ListRow>
        ))}
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label>This week</Label>
          <Body bold>{fmtMinutes(weekTotal)}</Body>
        </View>
        {week.length === 0 && <Body muted size={14} style={{ marginTop: 10 }}>Nothing yet this week.</Body>}
        {week.map((s, i) => (
          <ListRow key={s.id} first={i === 0}>
            <Body bold style={{ width: 92 }}>{fmtDay(s.clock_in_at).split(' ').slice(0, 2).join(' ')}</Body>
            <Body muted size={14} style={{ flex: 1 }}>
              {fmtTime(s.clock_in_at)} to {s.clock_out_at ? fmtTime(s.clock_out_at) : 'now'}
            </Body>
            <Body size={14} bold>{fmtMinutes(workedMin(s, now))}</Body>
          </ListRow>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.plum, borderRadius: 16, padding: 20, gap: 16 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTz: { fontFamily: fonts.body, fontSize: 13, color: colors.onDark },
  heroTime: { fontFamily: fonts.display, fontSize: 56, color: colors.cream, lineHeight: 60 },
  heroSub: { fontFamily: fonts.body, fontSize: 14, color: colors.onDark, marginTop: 6 },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroLineText: { fontFamily: fonts.body, fontSize: 13, color: colors.onDark, flex: 1 },
});
