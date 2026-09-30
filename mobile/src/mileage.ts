import { CURRENT_PROPERTY } from './property.ts';
export type RoutePoint = { latitude: number; longitude: number; timestamp: number; accuracy: number; checkpoint?: boolean; breakBefore?: boolean; distanceIgnored?: boolean };
export type Trip = { id: string; date: string; origin: string; destination: string; purpose: string; miles: number; notes: string; odometerStart?: number; odometerEnd?: number; odometerEndEstimated?: boolean; route?: RoutePoint[]; source?: 'gps' | 'manual'; reviewNeeded?: boolean; startedAt?: number; endedAt?: number };
export type TripDraft = { date: string; origin: string; destination: string; purpose: string; miles: string; notes: string; odometerStart?: string; odometerEnd?: string };
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function newDraft(): TripDraft { return { date: today(), origin: '', destination: CURRENT_PROPERTY.address, purpose: '', miles: '', notes: '', odometerStart: '', odometerEnd: '' }; }
export function validDate(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}
export function odometerError(start = '', end = ''): string | null {
  for (const reading of [start, end]) if (reading.trim() && (!/^\d+(\.\d{1,2})?$/.test(reading.trim()) || !Number.isFinite(Number(reading)))) return 'Enter nonnegative odometer readings with up to two decimals.';
  if (end.trim() && !start.trim()) return 'Enter the starting odometer reading too.';
  if (start.trim() && end.trim() && Number(end) < Number(start)) return 'Ending odometer must be at least the starting reading.';
  return null;
}
export function validateTrip(draft: TripDraft): string | null {
  if (!validDate(draft.date)) return 'Enter a valid date in YYYY-MM-DD format.';
  if (draft.date > today()) return 'Use today or an earlier date for a completed trip.';
  if (!draft.origin.trim() || !draft.destination.trim()) return 'Enter both a starting location and destination.';
  if (!draft.purpose.trim()) return 'Add a business purpose for this trip.';
  if (!/^\d+(\.\d{1,2})?$/.test(draft.miles.trim()) || !Number.isFinite(Number(draft.miles)) || Number(draft.miles) <= 0 || Number(draft.miles) > 10000) return 'Enter total miles greater than 0 and at most 10,000, with up to two decimal places.';
  return odometerError(draft.odometerStart, draft.odometerEnd);
}
export function inPeriod(trips: Trip[], period: string, date = today()) {
  return trips.filter(trip => period === 'All time' || (trip.date <= date && trip.date.startsWith(date.slice(0, period === 'This month' ? 7 : 4))));
}
export function totalMiles(trips: Trip[]) { return Math.round(trips.reduce((sum, trip) => sum + Math.round(trip.miles * 100), 0)) / 100; }
export function decodeTrips(raw: string | null): Trip[] {
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(t => t && typeof t.id === 'string' && typeof t.miles === 'number' && Number.isFinite(t.miles) && t.miles >= 0 && ['date', 'origin', 'destination', 'purpose', 'notes'].every(key => typeof t[key] === 'string') && validDate(t.date) && (t.odometerStart === undefined || (typeof t.odometerStart === 'number' && Number.isFinite(t.odometerStart) && t.odometerStart >= 0)) && (t.odometerEnd === undefined || (typeof t.odometerEnd === 'number' && Number.isFinite(t.odometerEnd) && t.odometerStart !== undefined && t.odometerEnd >= t.odometerStart)) && (t.route === undefined || (Array.isArray(t.route) && t.route.every(validPoint)))) || new Set(parsed.map(t => t.id)).size !== parsed.length) throw new Error('Invalid mileage records');
  return parsed;
}
export function validPoint(p: RoutePoint) { return p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 && Number.isFinite(p.timestamp) && Number.isFinite(p.accuracy) && p.accuracy >= 0; }
export function distanceMiles(a: RoutePoint, b: RoutePoint) {
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function appendPoints(existing: RoutePoint[], incoming: RoutePoint[]): RoutePoint[] {
  const result = [...existing];
  for (const point of [...incoming].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!validPoint(point) || point.accuracy > 50) continue;
    const last = result[result.length - 1];
    if (last && point.timestamp <= last.timestamp) continue;
    const elapsed = last ? point.timestamp - last.timestamp : 0;
    const distance = last ? distanceMiles(last, point) : 0;
    if (last && elapsed <= 120000 && distance / (elapsed / 3600000) > 120) continue;
    // Ignore stationary GPS jitter, while retaining five-minute heartbeat points.
    const checkpoint = !last || point.timestamp - (result.findLast(p => p.checkpoint)?.timestamp ?? last.timestamp) >= 300000;
    const noise = !!last && distance * 1609.344 < Math.max(5, Math.min(last.accuracy, point.accuracy));
    if (noise && elapsed < 60000 && !checkpoint) continue;
    result.push({ ...point, checkpoint, breakBefore: !!last && elapsed > 120000, distanceIgnored: noise });
  }
  return result;
}
export function routeMiles(points: RoutePoint[]) { return Math.round(points.reduce((sum, p, i) => i === 0 || p.breakBefore || p.distanceIgnored ? sum : sum + distanceMiles(points[i - 1], p), 0) * 100) / 100; }
export function routeSegments(points: RoutePoint[]) { const segments: RoutePoint[][] = []; for (const p of points) { if (!segments.length || p.breakBefore) segments.push([]); segments[segments.length - 1].push(p); } return segments; }

