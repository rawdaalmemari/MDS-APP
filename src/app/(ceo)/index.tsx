import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { CarIcon, ChevronIcon, ClockIcon } from '../../components/icons';
import { Avatar, Badge, Body, Button, Card, ErrorBox, H1, Label, ListRow, Screen } from '../../components/ui';
import {
  decideLeave,
  friendlyError,
  getActiveTrip,
  getAttendanceToday,
  getBalancesFor,
  getCar,
  getPendingLeave,
  getRecentDecisions,
  getShiftsToReview,
  type LeaveRequest,
} from '../../lib/api';
import { leaveName, statusBadge } from '../../lib/labels';
import { colors, fonts } from '../../lib/theme';
import { fmtClock, fmtRange, fmtTime, initials, todayLabel } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';
import { useNow } from '../../lib/useNow';

export default function Overview() {
  const now = useNow(1000);
  const { data, error, refreshing, refresh, reload } = useLoad(async () => {
    const car = await getCar();
    const [pending, decided, attendance, active, review] = await Promise.all([
      getPendingLeave(),
      getRecentDecisions(),
      getAttendanceToday(),
      getActiveTrip(car.id),
      getShiftsToReview(),
    ]);
    const balances = Object.fromEntries(await Promise.all(pending.map(async (r) => [r.id, await getBalancesFor(r.user_id)] as const)));
    return { pending, decided, attendance, active, balances, overtime: review.filter((s) => s.overtime_status === 'pending').length };
  });
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(r: LeaveRequest, approve: boolean) {
    setBusyId(r.id);
    setActionError(null);
    try {
      await decideLeave(r.id, approve);
      await reload();
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setBusyId(null);
    }
  }

  const staff = (data?.attendance ?? []).filter((a) => a.profile.role === 'staff');
  const inOffice = staff.filter((a) => a.shift && !a.shift.clock_out_at && !a.shift.left_area_at).length;
  const active = data?.active ?? null;

  return (
    <Screen header={<BrandHeader />} refreshing={refreshing} onRefresh={refresh}>
      <View>
        <Body muted size={14}>{todayLabel()}</Body>
        <H1>Overview</H1>
      </View>
      {error && <ErrorBox message={error} />}

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/(ceo)/attendance')} style={[styles.tile]}>
          <Body muted size={13} bold>In the office</Body>
          <Text style={styles.big}>
            {inOffice}
            <Text style={styles.bigOf}> / {staff.length}</Text>
          </Text>
        </Pressable>
        <View style={styles.tile}>
          <Body muted size={13} bold>Waiting for you</Body>
          <Text style={styles.big}>{(data?.pending.length ?? 0) + (data?.overtime ?? 0)}</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/(ceo)/cars')} style={[styles.tile, styles.rowTile]}>
        <View style={[styles.iconBox, { backgroundColor: active ? colors.maroon : colors.softRose }]}>
          <CarIcon color={active ? '#FFFFFF' : colors.maroon} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Body bold>{active ? `Car in use by ${active.profiles?.full_name ?? 'staff'}` : 'Car is available'}</Body>
          <Body muted size={14}>
            {active ? `Since ${fmtTime(active.started_at)} · ${fmtClock(now - new Date(active.started_at).getTime())}` : 'Tap to see the car log'}
          </Body>
        </View>
        <ChevronIcon />
      </Pressable>

      {!!data?.overtime && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/(ceo)/attendance')} style={[styles.tile, styles.rowTile, { borderColor: colors.orange }]}>
          <View style={[styles.iconBox, { backgroundColor: colors.pendingBg }]}>
            <ClockIcon color={colors.pendingFg} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Body bold>
              {data.overtime} overtime {data.overtime === 1 ? 'claim' : 'claims'} to review
            </Body>
            <Body muted size={14}>Overtime only counts once you approve it</Body>
          </View>
          <ChevronIcon />
        </Pressable>
      )}

      <View style={{ gap: 10 }}>
        <Label>Leave requests</Label>
        {actionError && <ErrorBox message={actionError} />}
        {data && data.pending.length === 0 && (
          <Card>
            <Body muted size={14}>You’re all caught up. No requests are waiting.</Body>
          </Card>
        )}
        {(data?.pending ?? []).map((r) => {
          const bal = data!.balances[r.id]?.find((b) => b.type === r.type);
          const name = r.profiles?.full_name ?? 'Staff';
          return (
            <Card key={r.id} style={{ gap: 12 }}>
              <View style={styles.rowTile}>
                <Avatar text={initials(name)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Body bold>{name}</Body>
                  <Body muted size={14}>
                    {leaveName[r.type]} · {fmtRange(r.start_date, r.end_date)} · {r.days} {r.days === 1 ? 'day' : 'days'}
                  </Body>
                </View>
              </View>
              {!!r.note && <Text style={styles.note}>“{r.note}”</Text>}
              {bal && (
                <Body muted size={13}>
                  {bal.remaining != null ? `${bal.remaining} ${r.type} days left before this request` : 'Unpaid leave'}
                </Body>
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Button small title="Reject" variant="danger" style={{ flex: 1 }} loading={busyId === r.id} onPress={() => decide(r, false)} />
                <Button small title="Approve" style={{ flex: 1 }} loading={busyId === r.id} onPress={() => decide(r, true)} />
              </View>
            </Card>
          );
        })}
        {!!data?.decided.length && (
          <Card style={{ paddingVertical: 4 }}>
            {data.decided.map((r, i) => (
              <ListRow key={r.id} first={i === 0}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Body bold size={15}>{r.profiles?.full_name}</Body>
                  <Body muted size={13}>
                    {leaveName[r.type]} · {fmtRange(r.start_date, r.end_date)}
                  </Body>
                </View>
                <Badge text={statusBadge[r.status].text} tone={statusBadge[r.status].tone} />
              </ListRow>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 16, gap: 6 },
  rowTile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { fontFamily: fonts.display, fontSize: 32, color: colors.plum, lineHeight: 36 },
  bigOf: { fontFamily: fonts.display, fontSize: 18, color: colors.muted },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  note: { fontFamily: fonts.body, fontSize: 14, color: colors.plum, backgroundColor: colors.cream, borderRadius: 10, padding: 12 },
});
