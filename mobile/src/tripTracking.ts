import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { appendPoints, odometerError, routeMiles, today, type RoutePoint, type Trip } from './mileage';
import { readMileage, updateMileage } from './mileageStore';

const TASK = 'staywell-trip-location-v1';
let foreground: Location.LocationSubscription | null = null;
let busy = false;
let pending: RoutePoint[] = [];
let trackerError = '';
export function getTrackerError() { return trackerError; }
function point(location: Location.LocationObject): RoutePoint { return { latitude: location.coords.latitude, longitude: location.coords.longitude, timestamp: location.timestamp, accuracy: location.coords.accuracy ?? 1000 }; }
export function coordinates(p: RoutePoint) { return `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`; }
function timeout<T>(promise: Promise<T>, ms = 15000): Promise<T> { return new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('GPS took too long. Check location access and try again.')), ms); promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); }); }); }
export async function currentPoint(): Promise<RoutePoint> {
  const permission = await timeout(Location.requestForegroundPermissionsAsync(), 20000);
  if (!permission.granted) throw new Error('Location permission is off. Enable precise location or enter your starting location manually.');
  const p = point(await timeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })));
  if (p.accuracy > 50 || Date.now() - p.timestamp > 120000) throw new Error('GPS is not accurate enough yet. Move to a clear area and try again.');
  return p;
}
export async function addressFor(p: RoutePoint) {
  if (Platform.OS !== 'web') {
    try {
      const [address] = await timeout(Location.reverseGeocodeAsync(p), 5000);
      if (address) return [address.streetNumber, address.street, address.city, address.region].filter(Boolean).join(' ');
    } catch { /* Coordinates are still a valid, accurate starting location. */ }
  }
  return coordinates(p);
}
async function accept(locations: Location.LocationObject[]) {
  pending.push(...locations.map(point));
  const batch = [...pending];
  try {
    await updateMileage(state => state.active && !state.active.stoppedAt ? { ...state, active: { ...state.active, points: appendPoints(state.active.points, batch) } } : state);
    pending = pending.filter(p => !batch.includes(p));
    trackerError = '';
  } catch { trackerError = 'Some GPS points could not be saved. Keep the app open and retry Stop to preserve them.'; }
}
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(TASK)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error) {
      trackerError = 'Location tracking was interrupted. Review this trip’s mileage.';
      try { await updateMileage(s => s.active ? { ...s, active: { ...s.active, warning: trackerError } } : s); } catch { /* Do not erase records on a storage failure. */ }
      return;
    }
    if (data?.locations) await accept(data.locations);
  });
}
export async function trackingRunning() {
  if (Platform.OS === 'web') return foreground !== null;
  return Location.hasStartedLocationUpdatesAsync(TASK);
}
export async function startTracking(options: { purpose: string; odometerStart: string }) {
  if (busy) throw new Error('A recording action is already in progress.');
  busy = true;
  try {
    const error = odometerError(options.odometerStart);
    if (error) throw new Error(error);
    if ((await readMileage()).active) throw new Error('Stop and save your existing recording first.');
    const first = await currentPoint();
    if (Platform.OS !== 'web') {
      if (!(await TaskManager.isAvailableAsync())) throw new Error('GPS recording requires a native development build. Manual trip logging is available here.');
      const permission = await Location.requestBackgroundPermissionsAsync();
      if (!permission.granted) throw new Error('Allow background location (Always on iPhone) to record while driving with the screen locked.');
    }
    const origin = await addressFor(first);
    await updateMileage(state => {
      if (state.active) throw new Error('There is already an active trip.');
      return { ...state, active: { id: `gps-${Date.now()}`, date: today(), startedAt: first.timestamp, origin, purpose: options.purpose.trim() || 'Property visit', odometerStart: options.odometerStart.trim() ? Number(options.odometerStart) : undefined, points: [{ ...first, checkpoint: true }], mode: Platform.OS === 'web' ? 'foreground' : 'background' } };
    });
    pending = [];
    trackerError = '';
    try {
      if (Platform.OS === 'web') foreground = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 }, locations => { void accept([locations]); }, reason => { trackerError = `GPS interrupted: ${reason}`; });
      else await Location.startLocationUpdatesAsync(TASK, { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 10000, distanceInterval: 10, deferredUpdatesInterval: 300000, pausesUpdatesAutomatically: false, activityType: Location.ActivityType.AutomotiveNavigation, showsBackgroundLocationIndicator: true, foregroundService: { notificationTitle: 'Staywell is recording your trip', notificationBody: 'Open Mileage and tap Stop to save the trip.', killServiceOnDestroy: false } });
    } catch (error) {
      await updateMileage(s => s.active ? { ...s, active: { ...s.active, stoppedAt: Date.now(), warning: 'Recording could not start. Stop to save this entry for review.' } } : s);
      throw error;
    }
  } finally { busy = false; }
}
export async function stopTracking(readings: { start: string; end: string }) {
  if (busy) throw new Error('A recording action is already in progress.');
  busy = true;
  try {
    const active = (await readMileage()).active;
    if (!active) return null;
    const readingError = odometerError(readings.start, readings.end);
    if (readingError) throw new Error(readingError);
    let final: RoutePoint | undefined;
    let warning = active.warning || trackerError;
    if (!active.stoppedAt) {
      if (!(await trackingRunning())) warning = 'Recording was interrupted. Review the captured route and mileage.';
      try { final = await currentPoint(); } catch { warning = 'Final GPS location unavailable. Review the recorded distance and destination.'; }
    }
    // Persist the stop boundary before unregistering; late task deliveries are ignored.
    await updateMileage(s => s.active ? { ...s, active: { ...s.active, points: appendPoints(s.active.points, [...pending, ...(final ? [final] : [])]), stoppedAt: s.active.stoppedAt ?? Date.now(), warning } } : s);
    foreground?.remove(); foreground = null;
    if (Platform.OS !== 'web' && await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
    const current = (await readMileage()).active;
    if (!current) return null;
    const last = current.points[current.points.length - 1];
    const destination = last ? await addressFor(last) : 'Location unavailable';
    const miles = routeMiles(current.points);
    const reviewNeeded = !!current.warning || current.points.some(p => p.breakBefore) || miles === 0;
    const trip: Trip = { id: current.id, date: current.date, origin: current.origin, destination, purpose: current.purpose, miles, notes: current.warning ?? '', odometerStart: readings.start.trim() ? Number(readings.start) : undefined, odometerEnd: readings.end.trim() ? Number(readings.end) : undefined, odometerEndEstimated: false, route: current.points, source: 'gps', reviewNeeded, startedAt: current.startedAt, endedAt: current.stoppedAt };
    await updateMileage(s => ({ ...s, trips: [...s.trips.filter(t => t.id !== trip.id), trip], active: s.active?.id === trip.id ? null : s.active }));
    pending = [];
    trackerError = '';
    return trip;
  } finally { busy = false; }
}
