import { createDemoData } from './createDemoData.ts';
import type { Reservation } from '../reservations/domain.ts';
import type { WorkEntry } from '../work/domain.ts';
export function adaptDemoData(today: Date) {
  const data = createDemoData(today);
  const createdAt = today.toISOString();
  const reservations: Reservation[] = data.reservations.map((r, index) => ({
    id: r.id, guestId: r.id + '-guest', overrides: {}, overrideUpdatedAt: null, updatedAt: createdAt,
    guest: { id: r.id + '-guest', displayName: r.guest, email: null, phone: null, profileUrl: null, profileSource: null, profileVerifiedManually: false, profileAddedAt: null, notes: 'Fictional demo guest.', createdAt, updatedAt: createdAt },
    source: { source: r.channel, connectionId: 'demo-only', externalId: r.id, propertyId: r.propertyId, sourceUpdatedAt: createdAt, guest: { displayName: r.guest }, checkIn: r.start, checkOut: r.end, status: 'confirmed', counts: { adults: 2 + index % 2, children: index % 3, infants: index % 4 === 0 ? 1 : 0, pets: index % 3 === 0 ? 1 : 0, totalHumanGuests: 2 + index % 2 + index % 3 + (index % 4 === 0 ? 1 : 0) }, rawGuestCounts: { demo: true, description: 'Synthetic party sizes for preview only' }, stayRevenueCents: Math.round(r.amount * 100), currency: 'USD', bookingUrl: null, cleaningRequired: null, hotTubService: null },
  }));
  const entries: WorkEntry[] = data.work.map(w => ({ id: w.id, userId: 'demo-owner', propertyId: w.propertyId, workDate: w.date, entryMethod: 'hours', startTime: '', endTime: '', minutesWorked: Math.round(w.hours * 60), workType: w.id.startsWith('demo-turnover') ? 'Cleaning' : w.id.startsWith('demo-hot-tub') ? 'Maintenance' : 'Purchasing / Supplies', description: w.activity, createdAt: w.date + 'T12:00:00.000Z', updatedAt: w.date + 'T12:00:00.000Z' }));
  return { properties: data.properties, reservations, entries, currentProperty: { ...data.properties[0], ownerId: 'demo-owner', cityStateZip: data.properties[0].location, address: data.properties[0].name + ', ' + data.properties[0].location } };
}

