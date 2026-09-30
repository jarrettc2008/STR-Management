import { nights, type GuestSex, type Reservation } from './domain.ts';

export type GuestAnalyticsPeriod = 'month' | '6month' | 'year';

export type GuestAverages = {
  period: GuestAnalyticsPeriod;
  periodLabel: string;
  rangeStart: string;
  rangeEnd: string;
  stays: number;
  guestsWithAge: number;
  averageAge: number | null;
  sexCounts: Record<GuestSex, number>;
  sexKnown: number;
  averageNights: number | null;
  topHomeLocations: { location: string; stays: number }[];
  locationsKnown: number;
  averagePartySize: number | null;
  partyKnown: number;
};

const SEX_KEYS: GuestSex[] = ['female', 'male', 'nonbinary', 'unspecified'];

function ymd(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

export function periodRange(period: GuestAnalyticsPeriod, today = new Date()): { start: string; end: string; label: string } {
  const end = ymd(today);
  if (period === 'month') {
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const label = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return { start, end, label };
  }
  if (period === '6month') {
    const startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    return { start: ymd(startDate), end, label: 'Last 6 months' };
  }
  const start = `${today.getFullYear()}-01-01`;
  return { start, end, label: String(today.getFullYear()) };
}

function overlapsRange(checkIn: string, checkOut: string, start: string, endExclusive: string) {
  // Inclusive calendar end day for filtering: use day after end as exclusive bound.
  return checkIn < endExclusive && checkOut > start;
}

export function guestAverages(
  reservations: Reservation[],
  period: GuestAnalyticsPeriod,
  propertyId?: string,
  today = new Date(),
): GuestAverages {
  const { start, end, label } = periodRange(period, today);
  const endExclusive = (() => {
    const d = new Date(end + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    return ymd(d);
  })();

  const stays = reservations.filter(
    (r) =>
      r.source.status === 'confirmed' &&
      (!propertyId || r.source.propertyId === propertyId) &&
      overlapsRange(r.source.checkIn, r.source.checkOut, start, endExclusive),
  );

  let ageSum = 0;
  let guestsWithAge = 0;
  const sexCounts = Object.fromEntries(SEX_KEYS.map((k) => [k, 0])) as Record<GuestSex, number>;
  let sexKnown = 0;
  let nightsSum = 0;
  let nightsKnown = 0;
  let partySum = 0;
  let partyKnown = 0;
  const locationCounts = new Map<string, number>();
  let locationsKnown = 0;

  for (const r of stays) {
    const age = r.guest.age;
    if (typeof age === 'number' && Number.isFinite(age) && age > 0 && age < 130) {
      ageSum += age;
      guestsWithAge += 1;
    }
    const sex = r.guest.sex;
    if (sex && SEX_KEYS.includes(sex)) {
      sexCounts[sex] += 1;
      sexKnown += 1;
    }
    const stayNights = nights(r.source.checkIn, r.source.checkOut);
    if (Number.isFinite(stayNights) && stayNights > 0) {
      nightsSum += stayNights;
      nightsKnown += 1;
    }
    const party = r.source.counts.totalHumanGuests;
    if (typeof party === 'number' && party >= 0) {
      partySum += party;
      partyKnown += 1;
    }
    const loc = r.guest.homeLocation?.trim();
    if (loc) {
      locationCounts.set(loc, (locationCounts.get(loc) ?? 0) + 1);
      locationsKnown += 1;
    }
  }

  const topHomeLocations = [...locationCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([location, count]) => ({ location, stays: count }));

  return {
    period,
    periodLabel: label,
    rangeStart: start,
    rangeEnd: end,
    stays: stays.length,
    guestsWithAge,
    averageAge: guestsWithAge ? ageSum / guestsWithAge : null,
    sexCounts,
    sexKnown,
    averageNights: nightsKnown ? nightsSum / nightsKnown : null,
    topHomeLocations,
    locationsKnown,
    averagePartySize: partyKnown ? partySum / partyKnown : null,
    partyKnown,
  };
}

export function formatAverage(value: number | null, digits = 1): string {
  return value === null ? '—' : value.toFixed(digits);
}
