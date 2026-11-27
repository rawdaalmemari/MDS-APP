-- Munazuri staff app: schema, security rules and server-side business rules.
-- Run with `supabase db push` (or paste into the SQL editor of a new Supabase project).
-- Times are stored in UTC (timestamptz). Office rules are evaluated in Asia/Dubai.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-------------------------------------------------------------------------------
-- Settings (single row). The CEO can change these later.
-------------------------------------------------------------------------------
create table public.settings (
  id int primary key default 1 check (id = 1),
  office_name text not null default 'Munazuri Design Studio',
  office_lat double precision default 25.2641556,  -- Munazuri Design Studio, Dubai (Google Maps pin)
  office_lng double precision default 55.3005031,
  clock_radius_m int not null default 150,  -- clock in / out allowed inside this radius
  reminder_radius_m int not null default 500, -- geofence used for reminders and auto clock-out
  workday_start time not null default '09:00',
  workday_end time not null default '17:30',
  work_days int[] not null default '{1,2,3,4,5}',      -- ISO days: 1 = Monday ... 7 = Sunday
  no_auto_clockout_days int[] not null default '{5}',  -- Friday: Juma prayer, never auto clock out
  auto_clockout_after_min int not null default 15,
  tz text not null default 'Asia/Dubai'
);
insert into public.settings (id) values (1);

-------------------------------------------------------------------------------
-- People
-------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'staff' check (role in ('staff', 'ceo')),
  push_token text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_ceo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'ceo' and active);
$$;

-- New auth users (invited by the CEO) get a staff profile automatically.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
          coalesce(new.raw_user_meta_data ->> 'role', 'staff'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-------------------------------------------------------------------------------
-- Notifications (in-app inbox + push via Expo)
-------------------------------------------------------------------------------
create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,  -- leave_request, leave_decision, overtime_request, auto_clock_out, clock_out_reminder
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, data) values (p_user, p_kind, p_title, p_body, p_data);
$$;

create or replace function public.notify_ceos(p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into notifications (user_id, kind, title, body, data)
  select id, p_kind, p_title, p_body, p_data from profiles where role = 'ceo' and active;
$$;

-- Every inbox row is also sent as a push notification through Expo's push service.
create or replace function public.push_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare tok text;
begin
  select push_token into tok from profiles where id = new.user_id;
  if tok is not null then
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_object('to', tok, 'title', new.title, 'body', new.body, 'sound', 'default',
                                 'data', new.data || jsonb_build_object('kind', new.kind, 'notification_id', new.id))
    );
  end if;
  return new;
end $$;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_notification();

-------------------------------------------------------------------------------
-- Attendance
-------------------------------------------------------------------------------
create or replace function public.distance_m(lat1 double precision, lng1 double precision,
                                             lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create table public.shifts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  clock_in_at timestamptz not null default now(),
  clock_in_distance_m int not null,
  clock_out_at timestamptz,
  clock_out_distance_m int,
  clock_out_method text check (clock_out_method in ('manual', 'auto')),
  left_area_at timestamptz,          -- set when the phone leaves the 500 m geofence while clocked in
  overtime_min int not null default 0,
  overtime_status text not null default 'none' check (overtime_status in ('none', 'pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz
);
create unique index one_open_shift_per_person on public.shifts (user_id) where clock_out_at is null;
create index on public.shifts (clock_in_at desc);

-- Minutes worked past the official end of the day (17:30 Dubai), counted only after CEO approval.
create or replace function public.overtime_minutes(p_in timestamptz, p_out timestamptz)
returns int language sql stable set search_path = public as $$
  select greatest(0, floor(extract(epoch from (
    p_out - (((p_in at time zone s.tz)::date + s.workday_end) at time zone s.tz)) / 60))::int)
  from settings s;
$$;

create or replace function public.office_distance(p_lat double precision, p_lng double precision)
returns int language plpgsql stable set search_path = public as $$
declare s settings;
begin
  select * into s from settings;
  if s.office_lat is null then raise exception 'Office location is not set yet'; end if;
  return round(distance_m(p_lat, p_lng, s.office_lat, s.office_lng));
end $$;

create or replace function public.clock_in(p_lat double precision, p_lng double precision)
returns public.shifts language plpgsql security definer set search_path = public as $$
declare d int; r shifts; s settings;
begin
  select * into s from settings;
  d := office_distance(p_lat, p_lng);
  if d > s.clock_radius_m then
    raise exception 'OUT_OF_RANGE:%', d using hint = 'Clock-in only works within ' || s.clock_radius_m || ' m of the studio';
  end if;
  insert into shifts (user_id, clock_in_distance_m) values (auth.uid(), d) returning * into r;
  return r;
exception when unique_violation then
  raise exception 'ALREADY_CLOCKED_IN';
end $$;

create or replace function public.close_shift(p_shift shifts, p_at timestamptz, p_distance int, p_method text)
returns public.shifts language plpgsql security definer set search_path = public as $$
declare ot int; r shifts; who text;
begin
  ot := overtime_minutes(p_shift.clock_in_at, p_at);
  update shifts set clock_out_at = p_at, clock_out_distance_m = p_distance, clock_out_method = p_method,
         overtime_min = ot, overtime_status = case when ot > 0 then 'pending' else 'none' end
   where id = p_shift.id returning * into r;
  if ot > 0 then
    select full_name into who from profiles where id = p_shift.user_id;
    perform notify_ceos('overtime_request', 'Overtime to review',
      who || ' worked ' || (ot / 60) || ' h ' || (ot % 60) || ' min after 5:30 PM. It only counts once you approve it.',
      jsonb_build_object('shift_id', r.id));
  end if;
  return r;
end $$;

create or replace function public.clock_out(p_lat double precision, p_lng double precision)
returns public.shifts language plpgsql security definer set search_path = public as $$
declare d int; sh shifts; s settings;
begin
  select * into s from settings;
  select * into sh from shifts where user_id = auth.uid() and clock_out_at is null;
  if not found then raise exception 'NOT_CLOCKED_IN'; end if;
  d := office_distance(p_lat, p_lng);
  if d > s.clock_radius_m then
    raise exception 'OUT_OF_RANGE:%', d using hint = 'Clock-out only works within ' || s.clock_radius_m || ' m of the studio';
  end if;
  return close_shift(sh, now(), d, 'manual');
end $$;

-- Called by the phone's geofence task.
create or replace function public.report_left_area() returns void
language sql security definer set search_path = public as $$
  update shifts set left_area_at = coalesce(left_area_at, now())
   where user_id = auth.uid() and clock_out_at is null;
$$;

create or replace function public.report_entered_area() returns void
language sql security definer set search_path = public as $$
  update shifts set left_area_at = null where user_id = auth.uid() and clock_out_at is null;
$$;

-- Runs every 5 minutes. Clocks people out at the time they left the area if they
-- stayed away for 15+ minutes. Never on Fridays (Juma prayer).
create or replace function public.auto_clock_out() returns int
language plpgsql security definer set search_path = public as $$
declare s settings; sh shifts; n int := 0; t text;
begin
  select * into s from settings;
  for sh in
    select * from shifts
     where clock_out_at is null and left_area_at is not null
       and left_area_at < now() - make_interval(mins => s.auto_clockout_after_min)
       and not (extract(isodow from left_area_at at time zone s.tz)::int = any (s.no_auto_clockout_days))
  loop
    perform close_shift(sh, sh.left_area_at, null, 'auto');
    t := to_char(sh.left_area_at at time zone s.tz, 'HH24:MI');
    perform notify(sh.user_id, 'auto_clock_out', 'You were clocked out automatically',
      'You left the studio area at ' || t || ' and didn''t clock out, so your day ended at ' || t || '.',
      jsonb_build_object('shift_id', sh.id));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Runs at 17:30 Dubai on work days: "Are you ready to clock out?"
create or replace function public.end_of_day_reminder() returns void
language sql security definer set search_path = public as $$
  select notify(user_id, 'clock_out_reminder', 'Are you ready to clock out?',
                'It''s 5:30 PM and you''re still clocked in.', '{}'::jsonb)
    from shifts where clock_out_at is null;
$$;

create or replace function public.review_overtime(p_shift bigint, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
declare sh shifts;
begin
  if not is_ceo() then raise exception 'FORBIDDEN'; end if;
  update shifts set overtime_status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_shift and overtime_status = 'pending' returning * into sh;
  if found then
    perform notify(sh.user_id, 'overtime_decision',
      case when p_approve then 'Overtime approved' else 'Overtime not counted' end,
      case when p_approve then (sh.overtime_min / 60) || ' h ' || (sh.overtime_min % 60) || ' min of overtime will count this month.'
           else 'Your time after 5:30 PM on ' || to_char(sh.clock_in_at at time zone 'Asia/Dubai', 'DD Mon') || ' won''t be counted.' end,
      jsonb_build_object('shift_id', sh.id));
  end if;
end $$;

-------------------------------------------------------------------------------
-- Leave
-------------------------------------------------------------------------------
create table public.leave_types (
  code text primary key,
  name text not null,
  yearly_days int,  -- null = no limit
  sort int not null default 0
);
insert into public.leave_types values
  ('annual', 'Annual', 30, 1), ('sick', 'Sick', 15, 2), ('unpaid', 'Unpaid', null, 3);

create table public.leave_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  type text not null references public.leave_types (code),
  start_date date not null,
  end_date date not null,
  days int not null default 0,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create or replace function public.working_days(p_from date, p_to date) returns int
language sql stable set search_path = public as $$
  select count(*)::int from generate_series(p_from, p_to, interval '1 day') d, settings s
   where extract(isodow from d)::int = any (s.work_days);
$$;

create or replace view public.leave_balances with (security_invoker = true) as
select p.id as user_id, t.code as type, t.name, t.yearly_days,
       coalesce(sum(r.days) filter (where r.status = 'approved'), 0)::int as used,
       coalesce(sum(r.days) filter (where r.status = 'pending'), 0)::int as pending,
       case when t.yearly_days is null then null
            else t.yearly_days - coalesce(sum(r.days) filter (where r.status = 'approved'), 0)::int end as remaining
  from profiles p cross join leave_types t
  left join leave_requests r on r.user_id = p.id and r.type = t.code
        and extract(year from r.start_date) = extract(year from (now() at time zone 'Asia/Dubai'))
 group by p.id, t.code, t.name, t.yearly_days, t.sort
 order by t.sort;

create or replace function public.before_leave_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare remaining int;
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.days := working_days(new.start_date, new.end_date);
  if new.days = 0 then raise exception 'NO_WORKING_DAYS'; end if;
  select b.remaining into remaining from leave_balances b where b.user_id = new.user_id and b.type = new.type;
  if remaining is not null and new.days > remaining then
    raise exception 'NOT_ENOUGH_BALANCE:%', remaining;
  end if;
  return new;
end $$;
create trigger leave_before_insert before insert on public.leave_requests
  for each row execute function public.before_leave_insert();

create or replace function public.after_leave_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare who text; tname text;
begin
  select full_name into who from profiles where id = new.user_id;
  select lower(name) into tname from leave_types where code = new.type;
  perform notify_ceos('leave_request', 'New leave request',
    who || ' asked for ' || new.days || case when new.days = 1 then ' day' else ' days' end || ' of ' || tname || ' leave, ' ||
    to_char(new.start_date, 'DD Mon') || case when new.end_date <> new.start_date then ' to ' || to_char(new.end_date, 'DD Mon') else '' end || '.',
    jsonb_build_object('leave_id', new.id));
  return new;
end $$;
create trigger leave_after_insert after insert on public.leave_requests
  for each row execute function public.after_leave_insert();

create or replace function public.decide_leave(p_id bigint, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r leave_requests; tname text;
begin
  if not is_ceo() then raise exception 'FORBIDDEN'; end if;
  update leave_requests set status = case when p_approve then 'approved' else 'rejected' end,
         decided_by = auth.uid(), decided_at = now(), decision_note = p_note
   where id = p_id and status = 'pending' returning * into r;
  if not found then raise exception 'NOT_PENDING'; end if;
  select lower(name) into tname from leave_types where code = r.type;
  perform notify(r.user_id, 'leave_decision',
    case when p_approve then 'Leave approved' else 'Leave not approved' end,
    'Your ' || tname || ' leave for ' || to_char(r.start_date, 'DD Mon') ||
    case when r.end_date <> r.start_date then ' to ' || to_char(r.end_date, 'DD Mon') else '' end ||
    case when p_approve then ' was approved.' else ' was rejected.' || coalesce(' ' || p_note, '') end,
    jsonb_build_object('leave_id', r.id));
end $$;

-------------------------------------------------------------------------------
-- Office car
-------------------------------------------------------------------------------
create table public.cars (
  id int generated always as identity primary key,
  name text not null,
  plate text not null default ''
);
insert into public.cars (name) values ('Studio car');

create table public.car_trips (
  id bigint generated always as identity primary key,
  car_id int not null references public.cars (id),
  driver_id uuid not null references public.profiles (id) on delete cascade,
  started_at timestamptz not null default now(),
  start_photo text not null,   -- storage path in the fuel-photos bucket
  ended_at timestamptz,
  end_photo text,
  reason text not null default ''
);
create unique index one_active_trip_per_car on public.car_trips (car_id) where ended_at is null;
create index on public.car_trips (started_at desc);

create or replace function public.start_trip(p_car int, p_photo text, p_reason text) returns public.car_trips
language plpgsql security definer set search_path = public as $$
declare t car_trips;
begin
  if p_photo not like auth.uid()::text || '/%' then raise exception 'BAD_PHOTO_PATH'; end if;
  insert into car_trips (car_id, driver_id, start_photo, reason)
  values (p_car, auth.uid(), p_photo, coalesce(p_reason, '')) returning * into t;
  return t;
exception when unique_violation then
  raise exception 'CAR_IN_USE';
end $$;

create or replace function public.end_trip(p_trip bigint, p_photo text) returns public.car_trips
language plpgsql security definer set search_path = public as $$
declare t car_trips;
begin
  if p_photo not like auth.uid()::text || '/%' then raise exception 'BAD_PHOTO_PATH'; end if;
  update car_trips set ended_at = now(), end_photo = p_photo
   where id = p_trip and driver_id = auth.uid() and ended_at is null returning * into t;
  if not found then raise exception 'NO_ACTIVE_TRIP'; end if;
  return t;
end $$;

-------------------------------------------------------------------------------
-- Row level security: staff see their own rows, the CEO sees everything.
-- All writes that carry business rules go through the functions above.
-------------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;
alter table public.shifts enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.cars enable row level security;
alter table public.car_trips enable row level security;

create policy "read settings" on public.settings for select to authenticated using (true);
create policy "ceo edits settings" on public.settings for update to authenticated using (is_ceo());

create policy "read own or ceo" on public.profiles for select to authenticated using (id = auth.uid() or is_ceo());
create policy "ceo manages people" on public.profiles for update to authenticated using (is_ceo());

create policy "own inbox" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "mark own read" on public.notifications for update to authenticated using (user_id = auth.uid());

create policy "own or ceo shifts" on public.shifts for select to authenticated using (user_id = auth.uid() or is_ceo());

create policy "read leave types" on public.leave_types for select to authenticated using (true);
create policy "own or ceo leave" on public.leave_requests for select to authenticated using (user_id = auth.uid() or is_ceo());
create policy "request leave" on public.leave_requests for insert to authenticated with check (user_id = auth.uid());
create policy "cancel own pending" on public.leave_requests for update to authenticated
  using (user_id = auth.uid() and status = 'pending') with check (status = 'cancelled');

create policy "read cars" on public.cars for select to authenticated using (true);
-- Everyone can see who has the car right now; the full history is visible to the CEO and to the driver.
create policy "trips visible" on public.car_trips for select to authenticated
  using (driver_id = auth.uid() or is_ceo() or ended_at is null);

-- Users may only change their own push token (and nothing else) on their profile.
create or replace function public.set_push_token(p_token text) returns void
language sql security definer set search_path = public as $$
  update profiles set push_token = p_token where id = auth.uid();
$$;

create or replace function public.mark_all_read() returns void
language sql security definer set search_path = public as $$
  update notifications set read_at = now() where user_id = auth.uid() and read_at is null;
$$;

-------------------------------------------------------------------------------
-- Storage: fuel gauge photos. Path = <user id>/<timestamp>.jpg
-------------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('fuel-photos', 'fuel-photos', false)
  on conflict (id) do nothing;

create policy "upload own fuel photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'fuel-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own or ceo fuel photos" on storage.objects for select to authenticated
  using (bucket_id = 'fuel-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_ceo()));

-------------------------------------------------------------------------------
-- Scheduled jobs (pg_cron runs in UTC; Dubai is UTC+4, no daylight saving)
-------------------------------------------------------------------------------
select cron.schedule('auto-clock-out', '*/5 * * * *', $$select public.auto_clock_out()$$);
select cron.schedule('end-of-day-reminder', '30 13 * * 1-5', $$select public.end_of_day_reminder()$$);

-- Keep function execution limited to signed-in users.
revoke execute on function public.auto_clock_out() from public, anon, authenticated;
revoke execute on function public.end_of_day_reminder() from public, anon, authenticated;
revoke execute on function public.close_shift(public.shifts, timestamptz, int, text) from public, anon, authenticated;
revoke execute on function public.notify(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_ceos(text, text, text, jsonb) from public, anon, authenticated;
