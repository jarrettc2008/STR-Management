import type { RoutePoint, Trip } from '../mileage.ts';
import type { PropertyTaxPayment } from '../tax/taxSummary.ts';

function ymd(d: Date) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

/** Bentonville-area sample GPS polyline for map preview. */
export function demoRoute(path: [number, number][], startMs: number): RoutePoint[] {
  return path.map(([latitude, longitude], i) => ({
    latitude,
    longitude,
    timestamp: startMs + i * 60_000,
    accuracy: 8,
    checkpoint: i === 0 || i === path.length - 1 || i % 5 === 0,
  }));
}

/** Sample mileage trips for on-device testing, including GPS routes for map view. */
export function demoMileageTrips(today = new Date()): Trip[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = (offset: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return ymd(d);
  };
  const t0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 12, 15, 0, 0);
  return [
    {
      id: 'demo-trip-supplies',
      date: day(-12),
      origin: '516 Tiger Blvd, Bentonville, AR',
      destination: 'Home Depot, Bentonville, AR',
      purpose: 'Property supply run',
      miles: 8.4,
      notes: 'Demo sample trip · on-device only',
      odometerStart: 42110,
      odometerEnd: 42118,
      source: 'gps',
      route: demoRoute(
        [
          [36.3729, -94.2088],
          [36.3702, -94.2101],
          [36.3665, -94.2115],
          [36.3620, -94.2108],
          [36.3584, -94.2092],
        ],
        t0,
      ),
    },
    {
      id: 'demo-trip-turnover',
      date: day(-7),
      origin: 'Home, Bentonville, AR',
      destination: '516 Tiger Blvd, Bentonville, AR',
      purpose: 'Guest turnover cleaning',
      miles: 6.2,
      notes: 'Demo sample trip · on-device only',
      odometerStart: 42118,
      odometerEnd: 42124,
      source: 'gps',
      route: demoRoute(
        [
          [36.3510, -94.1980],
          [36.3580, -94.2010],
          [36.3650, -94.2050],
          [36.3729, -94.2088],
        ],
        t0 + 5 * 86_400_000,
      ),
    },
    {
      id: 'demo-trip-inspection',
      date: day(-3),
      origin: '516 Tiger Blvd, Bentonville, AR',
      destination: "Lowe's, Bentonville, AR",
      purpose: 'Hot tub parts pickup',
      miles: 5.1,
      notes: 'Demo sample trip · on-device only',
      source: 'manual',
    },
    {
      id: 'demo-trip-restock',
      date: day(-1),
      origin: '516 Tiger Blvd, Bentonville, AR',
      destination: 'Walmart, Rogers, AR',
      purpose: 'Restock toiletries and paper goods',
      miles: 14.8,
      notes: 'Demo sample trip · on-device only',
      odometerStart: 42130,
      odometerEnd: 42145,
      source: 'gps',
      route: demoRoute(
        [
          [36.3729, -94.2088],
          [36.3650, -94.1800],
          [36.3500, -94.1500],
          [36.3400, -94.1300],
          [36.3320, -94.1180],
        ],
        t0 + 11 * 86_400_000,
      ),
    },
  ];
}

export function demoTaxPayments(today = new Date()): PropertyTaxPayment[] {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return [
    {
      id: 'demo-tax-property-h1',
      date: `${year}-03-15`,
      label: 'Benton County property tax · 1st half',
      amountCents: 184500,
      notes: 'Demo sample · on-device only · not a real payment',
      kind: 'property',
    },
    {
      id: 'demo-tax-property-h2',
      date: `${year}-09-15`,
      label: 'Benton County property tax · 2nd half',
      amountCents: 184500,
      notes: 'Demo sample · on-device only · not a real payment',
      kind: 'property',
    },
    {
      id: 'demo-tax-lodging',
      date: `${year}-${month}-01`,
      label: 'Arkansas lodging tax remittance (sample)',
      amountCents: 42600,
      notes: 'Demo sample based on local stay activity · verify before any filing',
      kind: 'lodging',
    },
  ];
}
