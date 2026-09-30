import AsyncStorage from '@react-native-async-storage/async-storage';
import { decodeTrips, validPoint, type RoutePoint, type Trip } from './mileage';

export type ActiveTrip = { id: string; date: string; startedAt: number; stoppedAt?: number; origin: string; purpose: string; odometerStart?: number; points: RoutePoint[]; mode: 'background' | 'foreground'; warning?: string };
export type MileageState = { version: 2; trips: Trip[]; active: ActiveTrip | null };
const KEY = 'staywell.mileage.v2';
const listeners = new Set<() => void>();
let queue: Promise<unknown> = Promise.resolve();
export function subscribeMileage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export async function readMileage(): Promise<MileageState> {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw === null) return { version: 2, trips: decodeTrips(await AsyncStorage.getItem('staywell.mileage.v1')), active: null };
  const state = JSON.parse(raw);
  if (state.version !== 2) throw new Error('Unsupported mileage storage');
  const trips = decodeTrips(JSON.stringify(state.trips));
  const a = state.active;
  if (a !== null && (!a || typeof a.id !== 'string' || typeof a.date !== 'string' || !Number.isFinite(a.startedAt) || !['foreground', 'background'].includes(a.mode) || !Array.isArray(a.points) || !a.points.every(validPoint))) throw new Error('Invalid active trip');
  return { version: 2, trips, active: a };
}
// One storage transaction contains both trip history and the active recording.
// This makes Stop idempotent: a crash cannot append a trip and leave it recording.
export function updateMileage(update: (state: MileageState) => MileageState): Promise<MileageState> {
  const operation = queue.then(async () => {
    const next = update(await readMileage());
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach(listener => listener());
    return next;
  });
  queue = operation.catch(() => undefined);
  return operation;
}
