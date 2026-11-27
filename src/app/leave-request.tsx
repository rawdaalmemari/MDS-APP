import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { DateRangePicker } from '../components/DateRangePicker';
import { BackIcon, CalendarIcon } from '../components/icons';
import { Body, Button, Card, ErrorBox, H1, Screen } from '../components/ui';
import { friendlyError, getMyBalances, requestLeave, type LeaveType } from '../lib/api';
import { useMe } from '../lib/auth';
import { colors, fonts } from '../lib/theme';
import { dubaiParts, fmtRange } from '../lib/time';
import { useLoad } from '../lib/useLoad';

function workingDays(from: string, to: string) {
  let n = 0;
  for (let t = Date.parse(from + 'T00:00:00Z'); t <= Date.parse(to + 'T00:00:00Z'); t += 86400000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

const TYPES: { code: LeaveType; label: string }[] = [
  { code: 'annual', label: 'Annual' },
  { code: 'sick', label: 'Sick' },
  { code: 'unpaid', label: 'Unpaid' },
];

export default function LeaveRequest() {
  const me = useMe();
  const { data: balances } = useLoad(() => getMyBalances(me.id), [me.id]);
  const [type, setType] = useState<LeaveType>('annual');
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const end = to ?? from;
  const days = from && end ? workingDays(from, end) : 0;
  const bal = balances?.find((b) => b.type === type);
  const hint = bal?.remaining != null ? `${bal.remaining} ${type} days left this year` : 'Unpaid leave has no yearly limit';
  // Sick leave can be logged after the fact; other leave starts from today.
  const minDate = type === 'sick' ? new Date(Date.now() - 30 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' }) : dubaiParts().date;

  async function submit() {
    if (!from || !end || days === 0) {
      setError(days === 0 && from ? 'Those dates don’t include any working days.' : 'Pick your dates on the calendar.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestLeave({ type, start_date: from, end_date: end, note: note.trim() });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
        <BackIcon />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <H1>Request leave</H1>

      <View style={{ gap: 8 }}>
        <Text style={styles.fieldLabel}>Leave type</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {TYPES.map((t) => (
            <Pressable
              key={t.code}
              accessibilityRole="radio"
              accessibilityState={{ selected: type === t.code }}
              onPress={() => setType(t.code)}
              style={[styles.chip, type === t.code && styles.chipOn]}
            >
              <Text style={[styles.chipText, type === t.code && { color: colors.maroonDark }]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <Body muted size={13}>{hint}</Body>
      </View>

      <DateRangePicker
        from={from}
        to={to}
        minDate={minDate}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
          setError(null);
        }}
      />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 }}>
        <CalendarIcon size={20} color={colors.maroon} />
        <Body bold style={{ flex: 1 }}>
          {from && end ? `${fmtRange(from, end)} · ${days} working ${days === 1 ? 'day' : 'days'}` : 'Tap a start date, then an end date'}
        </Body>
      </Card>

      <View style={{ gap: 6 }}>
        <Text style={styles.fieldLabel}>Note for the CEO (optional)</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="e.g. Family wedding in Al Ain"
          placeholderTextColor={colors.muted}
          style={styles.note}
          accessibilityLabel="Note for the CEO"
        />
      </View>

      {error && <ErrorBox message={error} />}
      <Button title="Send to CEO for approval" onPress={submit} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, alignSelf: 'flex-start', marginTop: 8 },
  backText: { fontFamily: fonts.bold, fontSize: 15, color: colors.maroon },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.text2 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { height: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 1.5, borderColor: '#DCCDBE', backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipOn: { borderColor: colors.maroon, backgroundColor: colors.softRose },
  chipText: { fontFamily: fonts.bold, fontSize: 14, color: colors.plum },
  note: {
    minHeight: 84, borderRadius: 12, borderWidth: 1.5, borderColor: '#DCCDBE', backgroundColor: '#FFFFFF', padding: 12,
    fontFamily: fonts.body, fontSize: 16, color: colors.plum, textAlignVertical: 'top',
  },
});
