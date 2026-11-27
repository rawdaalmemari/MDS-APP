import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { BrandHeader } from '../../components/BrandHeader';
import { PlusIcon } from '../../components/icons';
import { Badge, Body, Button, Card, ErrorBox, H1, Label, ListRow, Screen } from '../../components/ui';
import { getMyBalances, getMyLeave } from '../../lib/api';
import { leaveName, statusBadge } from '../../lib/labels';
import { useMe } from '../../lib/auth';
import { colors, fonts } from '../../lib/theme';
import { fmtRange } from '../../lib/time';
import { useLoad } from '../../lib/useLoad';

export default function LeaveScreen() {
  const me = useMe();
  const { data, error, refreshing, refresh } = useLoad(async () => {
    const [balances, requests] = await Promise.all([getMyBalances(me.id), getMyLeave(me.id)]);
    return { balances, requests };
  }, [me.id]);

  return (
    <Screen header={<BrandHeader />} refreshing={refreshing} onRefresh={refresh}>
      <H1>My leave</H1>
      {error && <ErrorBox message={error} />}
      <View style={styles.grid}>
        {(data?.balances ?? []).map((b) => {
          const limited = b.yearly_days != null;
          const left = limited ? b.remaining! : b.used;
          const pct = limited ? Math.max(0, Math.min(1, b.remaining! / b.yearly_days!)) : 0;
          return (
            <Card key={b.type} style={styles.balance}>
              <Body muted size={13} bold>{b.name}</Body>
              <Text style={styles.big}>{left}</Text>
              <Body muted size={12}>
                {limited ? `of ${b.yearly_days} left` : 'days taken'}
                {b.pending ? ` · ${b.pending} pending` : ''}
              </Body>
              <View style={styles.bar}>
                <View style={[styles.barFill, { width: `${pct * 100}%` }]} />
              </View>
            </Card>
          );
        })}
      </View>
      <Button title="Request leave" icon={<PlusIcon />} onPress={() => router.push('/leave-request')} />
      <Card>
        <Label>My requests</Label>
        {data && data.requests.length === 0 && <Body muted size={14} style={{ marginTop: 10 }}>No leave requests yet.</Body>}
        {(data?.requests ?? []).map((r, i) => (
          <ListRow key={r.id} first={i === 0} style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Body bold>
                {leaveName[r.type]} leave · {r.days} {r.days === 1 ? 'day' : 'days'}
              </Body>
              <Body muted size={14}>{fmtRange(r.start_date, r.end_date)}</Body>
              {!!r.note && <Body muted size={13}>“{r.note}”</Body>}
              {!!r.decision_note && <Body size={13}>CEO: {r.decision_note}</Body>}
            </View>
            <Badge text={statusBadge[r.status].text} tone={statusBadge[r.status].tone} />
          </ListRow>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: 10 },
  balance: { flex: 1, paddingHorizontal: 12, paddingVertical: 14, gap: 6 },
  big: { fontFamily: fonts.display, fontSize: 30, color: colors.plum, lineHeight: 34 },
  bar: { height: 6, borderRadius: 3, backgroundColor: colors.chip, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: colors.maroon },
});
