import { decode } from 'base64-arraybuffer';
import { FUEL_BUCKET, supabase } from './supabase';
import { dubaiStartOfToday } from './time';

export type Role = 'staff' | 'ceo';
export type Profile = { id: string; full_name: string; role: Role; active: boolean };
export type Settings = {
  office_name: string;
  office_lat: number | null;
  office_lng: number | null;
  clock_radius_m: number;
  reminder_radius_m: number;
  workday_start: string;
  workday_end: string;
  work_days: number[];
  no_auto_clockout_days: number[];
  auto_clockout_after_min: number;
};
export type Shift = {
  id: number;
  user_id: string;
  clock_in_at: string;
  clock_in_distance_m: number;
  clock_out_at: string | null;
  clock_out_distance_m: number | null;
  clock_out_method: 'manual' | 'auto' | null;
  left_area_at: string | null;
  overtime_min: number;
  overtime_status: 'none' | 'pending' | 'approved' | 'rejected';
};
export type LeaveType = 'annual' | 'sick' | 'unpaid';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type LeaveRequest = {
  id: number;
  user_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  days: number;
  note: string;
  status: LeaveStatus;
  decision_note: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};
export type LeaveBalance = { type: LeaveType; name: string; yearly_days: number | null; used: number; pending: number; remaining: number | null };
export type Trip = {
  id: number;
  car_id: number;
  driver_id: string;
  started_at: string;
  start_photo: string;
  ended_at: string | null;
  end_photo: string | null;
  reason: string;
  profiles?: { full_name: string } | null;
};
export type Notification = {
  id: number;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/** Turns database errors into sentences people can act on. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  const range = msg.match(/OUT_OF_RANGE:(\d+)/);
  if (range) {
    const d = Number(range[1]);
    const dist = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`;
    return `You’re ${dist} from the studio. This only works within 150 m of the studio.`;
  }
  const balance = msg.match(/NOT_ENOUGH_BALANCE:(\d+)/);
  if (balance) return `You only have ${balance[1]} days left of this leave type.`;
  const known: Record<string, string> = {
    ALREADY_CLOCKED_IN: 'You’re already clocked in.',
    NOT_CLOCKED_IN: 'You’re not clocked in.',
    NO_WORKING_DAYS: 'Those dates don’t include any working days.',
    CAR_IN_USE: 'Someone else has the car right now.',
    NO_ACTIVE_TRIP: 'This trip has already ended.',
    NOT_PENDING: 'This request has already been decided.',
    FORBIDDEN: 'Only the CEO can do this.',
    'Office location is not set yet': 'The studio’s location hasn’t been set yet. Ask the CEO to set it.',
  };
  for (const k of Object.keys(known)) if (msg.includes(k)) return known[k]!;
  if (/network|fetch/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function must<T = any>(res: { data: unknown; error: unknown }): T {
  if (res.error) throw res.error;
  return res.data as T;
}

// ---------- profile & settings ----------
export async function getProfile(userId: string): Promise<Profile | null> {
  return must(await supabase.from('profiles').select('id, full_name, role, active').eq('id', userId).maybeSingle());
}

export async function getSettings(): Promise<Settings> {
  return must(await supabase.from('settings').select('*').single());
}

export async function setPushToken(token: string | null) {
  must(await supabase.rpc('set_push_token', { p_token: token }));
}

// ---------- attendance ----------
export async function getOpenShift(userId: string): Promise<Shift | null> {
  return must(await supabase.from('shifts').select('*').eq('user_id', userId).is('clock_out_at', null).maybeSingle());
}

export async function getMyShiftsSince(userId: string, sinceIso: string): Promise<Shift[]> {
  return must(await supabase.from('shifts').select('*').eq('user_id', userId).gte('clock_in_at', sinceIso).order('clock_in_at', { ascending: false }));
}

export async function clockIn(lat: number, lng: number): Promise<Shift> {
  return must(await supabase.rpc('clock_in', { p_lat: lat, p_lng: lng }));
}

export async function clockOut(lat: number, lng: number): Promise<Shift> {
  return must(await supabase.rpc('clock_out', { p_lat: lat, p_lng: lng }));
}

export async function reportLeftArea() {
  must(await supabase.rpc('report_left_area'));
}

export async function reportEnteredArea() {
  must(await supabase.rpc('report_entered_area'));
}

export type AttendanceRow = { profile: Profile; shift: Shift | null; onLeave: LeaveRequest | null };

export async function getAttendanceToday(): Promise<AttendanceRow[]> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  const [people, shifts, leave] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, active').eq('active', true).order('full_name'),
    supabase.from('shifts').select('*').gte('clock_in_at', dubaiStartOfToday()).order('clock_in_at', { ascending: false }),
    supabase.from('leave_requests').select('*').eq('status', 'approved').lte('start_date', today).gte('end_date', today),
  ]);
  const ps = must(people) as Profile[];
  const ss = must(shifts) as Shift[];
  const ls = must(leave) as LeaveRequest[];
  return ps.map((p) => ({
    profile: p,
    shift: ss.find((s) => s.user_id === p.id) ?? null,
    onLeave: ls.find((l) => l.user_id === p.id) ?? null,
  }));
}

export type ReviewShift = Shift & { profiles: { full_name: string } | null };

export async function getShiftsToReview(): Promise<ReviewShift[]> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  return must(
    await supabase
      .from('shifts')
      .select('*, profiles!shifts_user_id_fkey(full_name)')
      .or(`overtime_status.eq.pending,and(clock_out_method.eq.auto,clock_in_at.gte.${since}),and(clock_out_at.is.null,left_area_at.not.is.null)`)
      .order('clock_in_at', { ascending: false })
      .limit(30),
  );
}

export async function reviewOvertime(shiftId: number, approve: boolean) {
  must(await supabase.rpc('review_overtime', { p_shift: shiftId, p_approve: approve }));
}

// ---------- leave ----------
export async function getMyBalances(userId: string): Promise<LeaveBalance[]> {
  return must(await supabase.from('leave_balances').select('type, name, yearly_days, used, pending, remaining').eq('user_id', userId));
}

export async function getBalancesFor(userId: string) {
  return getMyBalances(userId);
}

export async function getMyLeave(userId: string): Promise<LeaveRequest[]> {
  return must(await supabase.from('leave_requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50));
}

export async function requestLeave(input: { type: LeaveType; start_date: string; end_date: string; note: string }) {
  must(await supabase.from('leave_requests').insert(input));
}

export async function cancelLeave(id: number) {
  must(await supabase.from('leave_requests').update({ status: 'cancelled' }).eq('id', id));
}

export async function getPendingLeave(): Promise<LeaveRequest[]> {
  return must(
    await supabase.from('leave_requests').select('*, profiles!leave_requests_user_id_fkey(full_name)').eq('status', 'pending').order('created_at'),
  );
}

export async function getRecentDecisions(): Promise<LeaveRequest[]> {
  return must(
    await supabase
      .from('leave_requests')
      .select('*, profiles!leave_requests_user_id_fkey(full_name)')
      .in('status', ['approved', 'rejected'])
      .order('decided_at', { ascending: false })
      .limit(5),
  );
}

export async function decideLeave(id: number, approve: boolean, note?: string) {
  must(await supabase.rpc('decide_leave', { p_id: id, p_approve: approve, p_note: note ?? null }));
}

// ---------- car ----------
export async function getCar(): Promise<{ id: number; name: string; plate: string }> {
  return must(await supabase.from('cars').select('id, name, plate').order('id').limit(1).single());
}

export async function getActiveTrip(carId: number): Promise<Trip | null> {
  return must(
    await supabase.from('car_trips').select('*, profiles(full_name)').eq('car_id', carId).is('ended_at', null).maybeSingle(),
  );
}

export async function getTrips(opts: { driverId?: string; limit?: number } = {}): Promise<Trip[]> {
  let q = supabase.from('car_trips').select('*, profiles(full_name)').not('ended_at', 'is', null);
  if (opts.driverId) q = q.eq('driver_id', opts.driverId);
  return must(await q.order('started_at', { ascending: false }).limit(opts.limit ?? 50));
}

export async function getTrip(id: number): Promise<Trip> {
  return must(await supabase.from('car_trips').select('*, profiles(full_name)').eq('id', id).single());
}

export async function uploadFuelPhoto(userId: string, base64: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;
  must(await supabase.storage.from(FUEL_BUCKET).upload(path, decode(base64), { contentType: 'image/jpeg' }));
  return path;
}

export async function photoUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(FUEL_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function startTrip(carId: number, photoPath: string, reason: string): Promise<Trip> {
  return must(await supabase.rpc('start_trip', { p_car: carId, p_photo: photoPath, p_reason: reason }));
}

export async function endTrip(tripId: number, photoPath: string): Promise<Trip> {
  return must(await supabase.rpc('end_trip', { p_trip: tripId, p_photo: photoPath }));
}

// ---------- notifications ----------
export async function getNotifications(): Promise<Notification[]> {
  return must(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50));
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead() {
  must(await supabase.rpc('mark_all_read'));
}

// ---------- people (CEO) ----------
export async function inviteStaff(fullName: string, email: string) {
  const { data, error } = await supabase.functions.invoke('invite-staff', { body: { fullName, email } });
  if (error) throw error;
  return data;
}
