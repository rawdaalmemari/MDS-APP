# Munazuri staff app

The staff app for Munazuri Design Studio, for iPhone and Android. Built with Expo (React Native) and Supabase.

## What it does

**Staff**
- Clock in and out. This only works within 150 m of the studio, and the server checks the distance.
- A reminder to clock in ("Don't forget to clock in") when they come within 500 m of the studio.
- "Are you ready to clock out?" when they leave the 500 m area while clocked in, and at 5:30 PM.
- Leave balances (Annual 30, Sick 15, Unpaid with no limit) and leave requests that go to the CEO.
- Office car: start a trip with a photo of the fuel gauge, end it with a second photo.
- A notifications inbox.

**CEO**
- Approve or reject leave requests, with the person's remaining balance shown.
- Today's attendance, plus a "Needs your review" list: overtime claims, automatic clock-outs, and people who left the area while still clocked in.
- The car log, showing who drove, when, for how long, and both fuel photos.
- Add staff by email from the Account screen. Nobody can sign up on their own.

**Rules that protect working hours**
- Office hours are Monday to Friday, 9:00 AM to 5:30 PM (Asia/Dubai).
- Monday to Thursday: if someone leaves the 500 m area and doesn't clock out within 15 minutes, the server clocks them out at the time they left, marked "auto".
- Fridays: no automatic clock-out, because staff leave for Juma prayer. They still get the reminder.
- Time after 5:30 PM is overtime. It only counts once the CEO approves it.

All of these settings live in the `settings` table, so the CEO's values can be changed without a new app release.

## Project layout

```
src/app/            screens (Expo Router)
  (staff)/          Clock, Leave, Car tabs
  (ceo)/            Overview, Attendance, Car log tabs
  leave-request.tsx, fuel-photo.tsx, trip/[id].tsx, notifications.tsx, account.tsx, login.tsx
src/lib/            Supabase client, data access, location and push helpers, brand theme
src/components/     shared UI, icons, logo, date picker
supabase/migrations database tables, security rules, business rules and scheduled jobs
supabase/functions  invite-staff (lets the CEO add people)
```

## Setup

### 1. Supabase (backend)

1. Create a project at supabase.com. The region closest to the UAE is a good choice.
2. In **Database > Extensions**, turn on `pg_net` and `pg_cron`.
3. Apply the database: `npx supabase link --project-ref <ref>` then `npx supabase db push`. You can also paste `supabase/migrations/0001_init.sql` into the SQL editor.
4. Deploy the invite function: `npx supabase functions deploy invite-staff`.
5. In **Authentication > Sign In / Providers**, turn off "Allow new users to sign up".
6. In **Authentication > Email Templates**, add `{{ .Token }}` to the Magic Link template so people receive a 6-digit code.
7. Create the CEO account. Under **Authentication > Users**, choose "Invite user" and enter the CEO's email. Then run this in the SQL editor:
   ```sql
   update profiles set role = 'ceo', full_name = 'Muna Alkendi' where id = (select id from auth.users where email = '<ceo email>');
   ```
   After that, the CEO adds everyone else from the app.

### 2. The app

```bash
cp .env.example .env    # paste the project URL and anon key from Supabase > Project Settings > API
npm install
npx eas-cli@latest init # creates the EAS project id that push notifications need
npx eas-cli@latest build --profile development --platform all
npx expo start
```

The app uses camera, background location and push notifications, so it needs a development build. It won't run fully in Expo Go.

### 3. Store release

```bash
npx eas-cli@latest build --platform all
npx eas-cli@latest submit --platform ios
npx eas-cli@latest submit --platform android
```

This needs an Apple Developer account ($99 a year) and a Google Play developer account ($25 one time). Both stores will ask why the app uses background location. The answer is the clock-in and clock-out reminders and the automatic clock-out.

## Checks

```bash
npm run typecheck
```
