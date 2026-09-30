import { today, validDate } from '../mileage.ts';
import { CURRENT_PROPERTY } from '../property.ts';

export const WORK_TYPES = ['Property Management', 'Maintenance', 'Repairs', 'Cleaning', 'Lawn / Exterior', 'Purchasing / Supplies', 'Administrative', 'Bookkeeping', 'Guest Services', 'Property Improvement', 'Travel', 'Other'] as const;
export type Property = { id: string; name: string };
export type WorkDraft = { propertyId: string; workDate: string; entryMethod: 'times' | 'hours'; startTime: string; endTime: string; hours: string; workType: string; description: string };
export type WorkEntry = Omit<WorkDraft, 'hours'> & { id: string; userId: string; minutesWorked: number; createdAt: string; updatedAt: string };
export type Filters = { year?: string; propertyId?: string; workType?: string; from?: string; to?: string; search?: string };
export function newWorkDraft(propertyId = CURRENT_PROPERTY.id): WorkDraft { return { propertyId, workDate: today(), entryMethod: 'times', startTime: '', endTime: '', hours: '', workType: 'Property Management', description: '' }; }
export function hours(minutes: number) { return (minutes / 60).toFixed(2).replace(/\.?0+$/, '') || '0'; }
export function exactTime(minutes: number) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
export function duration(draft: WorkDraft): number {
  let minutes: number;
  if (draft.entryMethod === 'times') {
    const clock = (value: string) => { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('Enter start and end times as HH:MM (24-hour time).'); const [h, m] = value.split(':').map(Number); return h * 60 + m; };
    minutes = clock(draft.endTime) - clock(draft.startTime);
    if (minutes <= 0) throw new Error('End time must be after start time. Split overnight work into separate dates.');
  } else if (draft.entryMethod === 'hours') {
    if (!/^\d{1,2}(\.\d{1,6})?$/.test(draft.hours.trim())) throw new Error('Enter positive hours, such as 1.75.');
    const [whole, fraction = ''] = draft.hours.trim().split('.');
    const scale = 10n ** BigInt(fraction.length);
    const numerator = (BigInt(whole) * scale + BigInt(fraction || '0')) * 60n;
    if (numerator % scale !== 0n) throw new Error('Hours must equal whole minutes (for example 1.75). Use start/end times for other durations.');
    minutes = Number(numerator / scale);
  } else throw new Error('Choose a time entry method.');
  if (minutes <= 0 || minutes > 1440) throw new Error('Each entry must be greater than zero and at most 24 hours.');
  return minutes;
}
export function validateWork(draft: WorkDraft) {
  if (!validDate(draft.workDate) || draft.workDate > today()) throw new Error('Choose a valid work date on or before today.');
  if (!draft.propertyId) throw new Error('Select a property.');
  if (!(WORK_TYPES as readonly string[]).includes(draft.workType)) throw new Error('Select a work type.');
  if (typeof draft.description !== 'string' || draft.description.trim().length < 5 || draft.description.trim().length > 4000) throw new Error('Describe the work in 5–4,000 characters.');
  return { ...draft, startTime: draft.entryMethod === 'times' ? draft.startTime : '', endTime: draft.entryMethod === 'times' ? draft.endTime : '', description: draft.description.trim(), minutesWorked: duration(draft) };
}
export function editDraft(entry: WorkEntry): WorkDraft {
  // Exact manual durations are multiples of 3 minutes, so two decimals round-trip.
  return { ...entry, hours: (entry.minutesWorked / 60).toFixed(2) };
}
export function filterWork(entries: WorkEntry[], f: Filters = {}) {
  return entries.filter(e => (!f.year || e.workDate.startsWith(f.year + '-')) && (!f.propertyId || e.propertyId === f.propertyId) && (!f.workType || e.workType === f.workType) && (!f.from || e.workDate >= f.from) && (!f.to || e.workDate <= f.to) && (!f.search || e.description.toLowerCase().includes(f.search.toLowerCase())))
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}
export const totalMinutes = (entries: WorkEntry[]) => entries.reduce((sum, e) => sum + e.minutesWorked, 0);
export function workReport(entries: WorkEntry[], properties: Property[], filters: Filters) {
  const rows = filterWork(entries, filters);
  const group = (key: (e: WorkEntry) => string) => { const result: Record<string, number> = {}; for (const e of rows) result[key(e)] = (result[key(e)] || 0) + e.minutesWorked; return result; };
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: String(i + 1).padStart(2, '0'), minutes: totalMinutes(rows.filter(e => Number(e.workDate.slice(5, 7)) === i + 1)) }));
  return { filters, properties, rows, totalMinutes: totalMinutes(rows), byType: group(e => e.workType), byProperty: group(e => e.propertyId), monthly };
}
export type WorkReport = ReturnType<typeof workReport>;
