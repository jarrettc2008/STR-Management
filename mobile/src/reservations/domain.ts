import { validDate } from '../mileage.ts';

export const COUNT_FIELDS = ['adults', 'children', 'infants', 'pets', 'totalHumanGuests'] as const;
export type CountField = typeof COUNT_FIELDS[number];
export type Counts = Record<CountField, number | null>;
export type Overrides = Partial<Counts>;
export type BookingSource = {
  source: string; connectionId: string; externalId: string; propertyId: string;
  sourceUpdatedAt: string; guest: { externalId?: string; displayName: string; email?: string; phone?: string };
  checkIn: string; checkOut: string; status: 'confirmed' | 'cancelled'; counts: Counts;
  stayRevenueCents: number | null; currency: string | null; bookingUrl: string | null;
  cleaningRequired: boolean | null; hotTubService: boolean | null;
  rawGuestCounts: Record<string, unknown>;
};
export type Guest = { id: string; displayName: string; email: string | null; phone: string | null; profileUrl: string | null; profileSource: string | null; profileVerifiedManually: boolean; profileAddedAt: string | null; notes: string; createdAt: string; updatedAt: string };
export type Reservation = { id: string; guestId: string; source: BookingSource; overrides: Overrides; overrideUpdatedAt: string | null; updatedAt: string; guest: Guest };
export function safeExternalUrl(value: string) {
  if (typeof value !== 'string' || value.length > 2048) throw new Error('Enter a valid HTTPS profile or booking URL.');
  let url: URL; try { url = new URL(value); } catch { throw new Error('Enter a full HTTPS URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error('Use an HTTPS URL without embedded credentials.');
  return url.href;
}
export function validateCounts(input: unknown, partial = false): Counts | Overrides {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Guest counts must be an object.');
  const result: Overrides = {};
  for (const field of COUNT_FIELDS) {
    if (partial && !Object.hasOwn(input, field)) continue;
    const value = (input as Record<string, unknown>)[field] ?? null;
    if (value !== null && (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 10000)) throw new Error(`${field}: enter a nonnegative whole number or leave unknown.`);
    result[field] = value as number | null;
  }
  return result;
}
export function validateBooking(input: BookingSource): BookingSource {
  const text = (v: unknown, max=200) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (![input.source,input.connectionId,input.externalId,input.propertyId,input.guest?.displayName].every(v=>text(v))) throw new Error('Source, connection, reservation, property and guest name are required.');
  if (!validDate(input.checkIn) || !validDate(input.checkOut) || input.checkOut <= input.checkIn || nights(input.checkIn,input.checkOut)>3660) throw new Error('Use valid check-in/out dates with checkout after check-in.');
  if (!['confirmed','cancelled'].includes(input.status)) throw new Error('Specify reservation status.');
  if (!/^\d{4}-\d\d-\d\dT/.test(input.sourceUpdatedAt) || !Number.isFinite(Date.parse(input.sourceUpdatedAt))) throw new Error('Source update timestamp is required to prevent stale synchronization.');
  if (input.guest.externalId !== undefined && !text(input.guest.externalId)) throw new Error('Invalid platform guest identifier.');
  for (const field of ['email','phone'] as const) if(input.guest[field] !== undefined && !text(input.guest[field],320)) throw new Error('Invalid supplied guest contact.');
  if(input.stayRevenueCents != null && (!Number.isSafeInteger(input.stayRevenueCents)||input.stayRevenueCents<0)) throw new Error('Revenue must be nonnegative integer cents or unknown.');
  if(input.currency != null && !/^[A-Z]{3}$/.test(input.currency)) throw new Error('Use a three-letter currency code.');
  for(const key of ['cleaningRequired','hotTubService'] as const)if(input[key]!=null&&typeof input[key]!=='boolean')throw new Error('Service requirements must be true, false or unknown.');
  if (!input.rawGuestCounts || typeof input.rawGuestCounts !== 'object' || Array.isArray(input.rawGuestCounts)) throw new Error('Preserve the original guest-count fields in rawGuestCounts.');
  return {...input,counts:validateCounts(input.counts) as Counts,bookingUrl:input.bookingUrl?safeExternalUrl(input.bookingUrl):null,sourceUpdatedAt:new Date(input.sourceUpdatedAt).toISOString(),stayRevenueCents:input.stayRevenueCents??null,currency:input.currency??null,cleaningRequired:input.cleaningRequired??null,hotTubService:input.hotTubService??null};
}
export function effectiveCounts(reservation: Pick<Reservation,'source'|'overrides'>) {
  const {source,overrides}=reservation;
  const counts={...source.counts,...overrides};
  const categories=['adults','children','infants'] as const;
  const complete=categories.every(k=>counts[k]!==null);
  const sum=complete?categories.reduce((n,k)=>n+counts[k]!,0):null;
  const categoryOverride=categories.some(k=>Object.hasOwn(overrides,k));
  const totalOverride=Object.hasOwn(overrides,'totalHumanGuests');
  // A changed breakdown must not silently keep the old source total.
  const total=totalOverride?overrides.totalHumanGuests! : categoryOverride?sum : source.counts.totalHumanGuests ?? sum;
  const provenance=totalOverride?'Manual override':categoryOverride?'Manual breakdown':source.counts.totalHumanGuests!==null?'Booking source':sum!==null?'Sum of supplied human counts':'Unknown';
  return {...counts,totalHumanGuests:total,provenance,conflict:total!==null&&sum!==null&&total!==sum};
}
const day=(date:string)=>Date.parse(date+'T00:00:00Z');
export const nights=(start:string,end:string)=>(day(end)-day(start))/86400000;
export const validMonth=(month:string)=>/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month);
export function monthlyAnalytics(reservations:Reservation[],month:string,propertyId?:string){
  if(!validMonth(month))throw new Error('Choose YYYY-MM between 1900 and 2199.');
  const start=month+'-01';const [year,m]=month.split('-').map(Number);const end=new Date(Date.UTC(year,m,1)).toISOString().slice(0,10);
  const active=reservations.filter(r=>r.source.status==='confirmed'&&(!propertyId||r.source.propertyId===propertyId));
  const stays=active.filter(r=>r.source.checkIn<end&&r.source.checkOut>start);
  const sums=Object.fromEntries(COUNT_FIELDS.map(k=>[k,{known:0,unknownStays:0}])) as Record<CountField,{known:number;unknownStays:number}>;
  let guestNights=0,unknownGuestNights=0,knownPartyStays=0;const occupied=new Set<string>();
  for(const r of stays){const c=effectiveCounts(r);const first=r.source.checkIn>start?r.source.checkIn:start;const last=r.source.checkOut<end?r.source.checkOut:end;const count=nights(first,last);
    for(const field of COUNT_FIELDS){if(c[field]===null)sums[field].unknownStays++;else sums[field].known+=c[field]!;}
    if(c.totalHumanGuests===null){unknownGuestNights+=count;}else{guestNights+=c.totalHumanGuests*count;knownPartyStays++;}
    for(let d=day(first);d<day(last);d+=86400000)occupied.add(r.source.propertyId+':'+d);
  }
  const departures=active.filter(r=>r.source.checkOut>=start&&r.source.checkOut<end);
  return {month,stays:stays.length,conflictingStays:stays.filter(r=>effectiveCounts(r).conflict).length,counts:sums,guestNights,unknownGuestNights,knownPartyStays,averagePartySize:knownPartyStays?sums.totalHumanGuests.known/knownPartyStays:null,occupiedPropertyNights:occupied.size,daysInMonth:nights(start,end),turnovers:departures.length,cleaningRequired:departures.filter(r=>r.source.cleaningRequired===true).length,cleaningUnknown:departures.filter(r=>r.source.cleaningRequired===null).length,hotTubService:departures.filter(r=>r.source.hotTubService===true).length,hotTubUnknown:departures.filter(r=>r.source.hotTubService===null).length};
}
