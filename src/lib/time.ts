export const TZ = 'Asia/Dubai';

export function fmtTime(iso: string | Date | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

export function fmtDay(iso: string | Date): string {
  return new Date(iso).toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
}

/** For plain dates like "2026-12-14" (no time zone). */
export function fmtDate(date: string): string {
  return new Date(date + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
}

export function fmtRange(from: string, to: string): string {
  return from === to ? fmtDate(from) : `${fmtDate(from)} to ${fmtDate(to)}`;
}

export function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
}

export function dubaiParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const isoDow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), minute: Number(get('minute')), isoDow };
}

/** Start of today in Dubai, as a UTC ISO string (Dubai is UTC+4 all year). */
export function dubaiStartOfToday(): string {
  return new Date(`${dubaiParts().date}T00:00:00+04:00`).toISOString();
}

export function greeting(): string {
  const h = dubaiParts().hour;
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function fmtDuration(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} min` : `${m} min`;
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  return h ? `${h} h ${min % 60} min` : `${min} min`;
}

export function fmtClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]!.toUpperCase()).join('').slice(0, 2);
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}
