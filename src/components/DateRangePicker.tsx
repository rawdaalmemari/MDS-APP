import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../lib/theme';
import { BackIcon, ChevronIcon } from './icons';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month calendar: first tap picks the start date, second tap the end date. Weekends are shown muted. */
export function DateRangePicker({
  from,
  to,
  minDate,
  onChange,
}: {
  from: string | null;
  to: string | null;
  minDate: string;
  onChange: (from: string | null, to: string | null) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const [y, m] = (from ?? minDate).split('-').map(Number);
    return { y: y!, m: m! - 1 };
  });

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const out: (null | { date: string; day: number; weekend: boolean })[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) {
      const dow = new Date(Date.UTC(cursor.y, cursor.m, d)).getUTCDay();
      out.push({ date: iso(cursor.y, cursor.m, d), day: d, weekend: dow === 0 || dow === 6 });
    }
    return out;
  }, [cursor]);

  const title = new Date(Date.UTC(cursor.y, cursor.m, 1)).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const move = (delta: number) => setCursor(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));

  function pick(date: string) {
    if (!from || (from && to) || date < from) onChange(date, null);
    else onChange(from, date);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => move(-1)} style={styles.nav}>
          <BackIcon color={colors.plum} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => move(1)} style={styles.nav}>
          <ChevronIcon size={20} color={colors.plum} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <Text key={i} style={styles.dow}>{d}</Text>
        ))}
        {cells.map((c, i) => {
          if (!c) return <View key={`e${i}`} style={styles.cell} />;
          const disabled = c.date < minDate;
          const isEnd = c.date === from || c.date === to;
          const inRange = !!from && !!to && c.date > from && c.date < to;
          return (
            <Pressable
              key={c.date}
              accessibilityRole="button"
              accessibilityState={{ selected: isEnd, disabled }}
              accessibilityLabel={c.date}
              disabled={disabled}
              onPress={() => pick(c.date)}
              style={[styles.cell, inRange && styles.inRange, isEnd && styles.end]}
            >
              <Text style={[styles.dayText, c.weekend && { color: colors.muted }, disabled && { color: '#B8ACA4' }, isEnd && { color: '#FFFFFF', fontFamily: fonts.bold }]}>
                {c.day}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: 18, color: colors.plum },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dow: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.bold, fontSize: 12, color: colors.muted, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  inRange: { backgroundColor: colors.softRose, borderRadius: 0 },
  end: { backgroundColor: colors.maroon },
  dayText: { fontFamily: fonts.body, fontSize: 15, color: colors.plum },
});
