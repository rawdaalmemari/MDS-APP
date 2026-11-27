import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getOpenShift, getSettings, reportEnteredArea, reportLeftArea, type Settings } from './api';
import { showLocalNotification } from './push';
import { supabase } from './supabase';
import { dubaiParts } from './time';

export const OFFICE_GEOFENCE_TASK = 'munazuri-office-geofence';

/** Current position for clocking in or out. The server checks the distance again. */
export async function getPosition(): Promise<{ lat: number; lng: number }> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) throw new Error('Location permission is needed to clock in and out. You can turn it on in Settings.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Watches the 500 m area around the studio, even when the app is closed.
 * Entering: "Don't forget to clock in". Leaving while clocked in: "Are you ready to clock out?"
 * and tells the server, which clocks the person out after 15 minutes (never on Fridays).
 */
export async function startOfficeGeofence(settings?: Settings): Promise<'on' | 'no-permission' | 'no-office'> {
  const s = settings ?? (await getSettings());
  if (s.office_lat == null || s.office_lng == null) return 'no-office';
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return 'no-permission';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (!bg.granted) return 'no-permission';
  await Location.startGeofencingAsync(OFFICE_GEOFENCE_TASK, [
    { identifier: 'office', latitude: s.office_lat, longitude: s.office_lng, radius: s.reminder_radius_m, notifyOnEnter: true, notifyOnExit: true },
  ]);
  return 'on';
}

export async function stopOfficeGeofence() {
  if (await Location.hasStartedGeofencingAsync(OFFICE_GEOFENCE_TASK)) await Location.stopGeofencingAsync(OFFICE_GEOFENCE_TASK);
}

type GeofenceData = { eventType: Location.LocationGeofencingEventType; region: Location.LocationRegion };

// Must be defined at module scope so it is registered when the app starts in the background.
TaskManager.defineTask<GeofenceData>(OFFICE_GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { data: auth } = await supabase.auth.getSession();
  const userId = auth.session?.user.id;
  if (!userId) return;

  try {
    const settings = await getSettings();
    const now = dubaiParts();
    const workDay = settings.work_days.includes(now.isoDow);
    const shift = await getOpenShift(userId);

    if (data.eventType === Location.LocationGeofencingEventType.Enter) {
      if (shift) {
        await reportEnteredArea();
      } else if (workDay && now.hour >= 6 && now.hour < 17) {
        await showLocalNotification('Don’t forget to clock in', 'You’re near the studio. Tap to clock in.', { kind: 'clock_in_reminder' });
      }
    } else if (data.eventType === Location.LocationGeofencingEventType.Exit && shift) {
      await reportLeftArea();
      const friday = settings.no_auto_clockout_days.includes(now.isoDow);
      await showLocalNotification(
        'Are you ready to clock out?',
        friday
          ? 'You’ve left the studio area. If you’re done for the day, come back in range to clock out.'
          : `You’ve left the studio area. If you don’t clock out within ${settings.auto_clockout_after_min} minutes, you’ll be clocked out automatically at the time you left.`,
        { kind: 'clock_out_reminder' },
      );
    }
  } catch {
    // Background work must never crash the app; the server-side job is the safety net.
  }
});
