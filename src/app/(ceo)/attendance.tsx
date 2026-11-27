import { useState } from 'react';
import { Text, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { Avatar, Badge, Body, Button, Card, ErrorBox, H1, Label, ListRow, Screen } from '../../components/ui';
import { friendlyError, getAttendanceToday, getShiftsToReview, reviewOvertime, type AttendanceRow, type ReviewShift } from '../../lib/api';
import { colors, fonts } from '../../lib/theme';
import { fmtDay, fmtMinutes, fmtTime, initials, todayLabel } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';

function statusOf(a: AttendanceRow): { text: string; tone: 'in' | 'neutral' | 'pending' | 'approved'; times: string } {
  const s = a.shift;
  if (a.onLeave && !s) return { text: 'On leave', tone: 'approved', times: `Leave until ${a.onLeave.end_date}` };
  if (!s) return { text: 'Not in', tone: 'neutral', times: 'No clock-in yet' };
  const late = Number(fmtTime(s.clock_in_at).replace(':', '')) > 910;
  const inText = `In ${fmtTime(s.clock_in_at)}`;
  if (!s.clock_out_at && s.left_area_at) return { text: 'Away', tone: 'pending', times: `${inText} · left the area ${fmtTime(s.left_area_at)}` };
  if (!s.clock_out_at) return { text: late ? 'Late' : 'In office', tone: late ? 'pending' : 'in', times: inText };
  if (s.clock_out_method === 'auto') return { text: 'Auto out', tone: 'pending', times: `${inText} · Auto out ${fmtTime(s.clock_out_at)}` };
  return { text: 'Left', tone: 'neutral', times: `${inText} · Out ${fmtTime(s.clock_out_at)}` };
}

function reviewText(s: ReviewShift) {
  if (s.overtime_status === 'pending')
    return { tag: 'Overtime', tone: 'pending' as const, detail: `${fmtMinutes(s.overtime_min)} after 5:30 PM.${s.clock_out_method === 'auto' ? ' Clocked out automatically.' : ` Clocked out at the studio, ${s.clock_out_distance_m} m away.`}` };
  if (!s.clock_out_at)
    return { tag: 'Away', tone: 'pending' as const, detail: `Left the studio area at ${fmtTime(s.left_area_at)} and is still clocked in. No automatic clock-out on Fridays.` };
  return { tag: 'Auto clock-out', tone: 'neutral' as const, detail: `Left the studio area and didn’t clock out, so the app ended the day at ${fmtTime(s.clock_out_at)}.` };
}

export default function Attendance() {
  const { data, error, refreshing, refresh, reload } = useLoad(async () => {
    const [rows, review] = await Promise.all([getAttendanceToday(), getShiftsToReview()]);
    return { rows: rows.filter((r) => r.profile.role === 'staff'), review };
  });
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(id: number, approve: boolean) {
    setBusy(id);
    setActionError(null);
    try {
      await reviewOvertime(id, approve);
      await reload();
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen header={<BrandHeader />} refreshing={refreshing} onRefresh={refresh}>
      <View>
        <Body muted size={14}>{todayLabel()}</Body>
        <H1>Attendance</H1>
      </View>
      {error && <ErrorBox message={error} />}

      {!!data?.review.length && (
        <View style={{ gap: 10 }}>
          <Label>Needs your review</Label>
          {actionError && <ErrorBox message={actionError} />}
          {data.review.map((s) => {
            const r = reviewText(s);
            const name = s.profiles?.full_name ?? 'Staff';
            return (
              <Card key={s.id} style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar text={initials(name)} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body bold>{name}</Body>
                    <Body muted size={13}>
                      {fmtDay(s.clock_in_at)} · In {fmtTime(s.clock_in_at)}
                      {s.clock_out_at ? ` · Out ${fmtTime(s.clock_out_at)}` : ''}
                    </Body>
                  </View>
                  <Badge text={r.tag} tone={r.tone} />
                </View>
                <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.plum, backgroundColor: colors.cream, borderRadius: 10, padding: 12 }}>
                  {r.detail}
                </Text>
                {s.overtime_status === 'pending' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Button small title="Don’t count" variant="danger" style={{ flex: 1 }} loading={busy === s.id} onPress={() => decide(s.id, false)} />
                    <Button small title="Approve overtime" style={{ flex: 1 }} loading={busy === s.id} onPress={() => decide(s.id, true)} />
                  </View>
                )}
              </Card>
            );
          })}
        </View>
      )}

      <Card style={{ paddingVertical: 4 }}>
        {data && data.rows.length === 0 && <Body muted size={14} style={{ paddingVertical: 12 }}>No staff added yet. Add people from your account screen.</Body>}
        {(data?.rows ?? []).map((a, i) => {
          const st = statusOf(a);
          return (
            <ListRow key={a.profile.id} first={i === 0}>
              <Avatar text={initials(a.profile.full_name)} />
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Body bold>{a.profile.full_name}</Body>
                <Body muted size={13}>{st.times}</Body>
              </View>
              <Badge text={st.text} tone={st.tone} />
            </ListRow>
          );
        })}
      </Card>

      <Card style={{ gap: 8 }}>
        <Label>How hours are protected</Label>
        <Body size={14}>Clock-in and clock-out only work within 150 m of the studio.</Body>
        <Body size={14}>
          Monday to Thursday, if someone leaves the 500 m area and doesn’t clock out within 15 minutes, they’re clocked out automatically at the time
          they left. On Fridays there’s no automatic clock-out, because staff leave for Juma prayer.
        </Body>
        <Body size={14}>Time after 5:30 PM only counts as overtime once you approve it.</Body>
      </Card>
    </Screen>
  );
}
