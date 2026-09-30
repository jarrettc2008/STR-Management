/**
 * On-device nightly rate recommendation for 516 Tiger Blvd, Bentonville, AR 72712
 * (3BR/2BA ~1352 sqft near Park Springs / downtown trails).
 *
 * Embedded public Bentonville market comps as of late Sep 2026 — no live sync.
 * Do not invent figures beyond the documented sources below.
 */

export type MarketComp = {
  source: string;
  url: string;
  periodNote: string;
  adrDollars?: number;
  medianAdrDollars?: number;
  top25AdrDollars?: number;
  bottom25AdrDollars?: number;
  peakSeasonAdrDollars?: number;
  shoulderAdrDollars?: number;
  lowSeasonAdrDollars?: number;
  occupancyPct?: number;
  revparDollars?: number;
  adrRangeNote?: string;
};

/** Public Bentonville market comps — sources documented from public pages (late Sep 2026). */
export const BENTONVILLE_MARKET_COMPS: MarketComp[] = [
  {
    // https://www.airroi.com/airbnb-data/united-states/arkansas/bentonville
    source: 'AirROI Bentonville',
    url: 'https://www.airroi.com/airbnb-data/united-states/arkansas/bentonville',
    periodNote: 'Aug 2025–Jul 2026',
    adrDollars: 232,
    medianAdrDollars: 198,
    top25AdrDollars: 273,
    bottom25AdrDollars: 146,
    peakSeasonAdrDollars: 249,
    shoulderAdrDollars: 230,
    lowSeasonAdrDollars: 220,
  },
  {
    // https://www.airdna.co/vacation-rental-data/app/us/arkansas/bentonville/overview
    source: 'AirDNA Bentonville',
    url: 'https://www.airdna.co/vacation-rental-data/app/us/arkansas/bentonville/overview',
    periodNote: 'through Aug 2026',
    adrDollars: 185,
    occupancyPct: 55,
    revparDollars: 102,
  },
  {
    source: 'Other public Bentonville summaries',
    url: '',
    periodNote: 'late Sep 2026 public summaries',
    adrRangeNote: '~$175–$203 ADR',
  },
];

/** Whole-dollar week strip for a mid-market 3BR near downtown/trails (between AirDNA $185 and AirROI median $198–avg $232). */
export const TIGER_BLVD_WEEK_RATES_DOLLARS = {
  mon: 189,
  tue: 189,
  wed: 195,
  thu: 199,
  fri: 235,
  sat: 245,
  sun: 209,
} as const;

export type WeekdayKey = keyof typeof TIGER_BLVD_WEEK_RATES_DOLLARS;

export type NightlyDayRate = {
  label: string;
  /** Whole-dollar recommended rate for this weekday. */
  rateDollars: number;
  weekday: WeekdayKey;
};

export type NightlyRateRecommendation = {
  propertyLabel: string;
  featuredDollars: number;
  featuredLabel: string;
  days: NightlyDayRate[];
  summary: string;
  caption: string;
  sources: MarketComp[];
};

const DAY_ORDER: { key: WeekdayKey; label: string }[] = [
  { key: 'mon', label: 'M' },
  { key: 'tue', label: 'T' },
  { key: 'wed', label: 'W' },
  { key: 'thu', label: 'T' },
  { key: 'fri', label: 'F' },
  { key: 'sat', label: 'S' },
  { key: 'sun', label: 'S' },
];

/** JS getDay(): 0=Sun … 6=Sat → our weekday keys. */
const DOW_TO_KEY: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Featured “next best” rate:
 * - Sun–Thu: next Friday weekend rate ($235)
 * - Fri: tonight’s Friday rate ($235)
 * - Sat: tonight’s Saturday rate ($245)
 */
export function pickFeaturedRate(now: Date = new Date()): { dollars: number; label: string } {
  const dow = now.getDay();
  if (dow === 6) {
    return { dollars: TIGER_BLVD_WEEK_RATES_DOLLARS.sat, label: 'Tonight’s Saturday rate' };
  }
  if (dow === 5) {
    return { dollars: TIGER_BLVD_WEEK_RATES_DOLLARS.fri, label: 'Tonight’s Friday rate' };
  }
  // Sun–Thu: lean into the coming weekend Friday as next best night
  return { dollars: TIGER_BLVD_WEEK_RATES_DOLLARS.fri, label: 'Next best weekend night' };
}

export function getNightlyRateRecommendation(now: Date = new Date()): NightlyRateRecommendation {
  const featured = pickFeaturedRate(now);
  const tonightKey = DOW_TO_KEY[now.getDay()];
  return {
    propertyLabel: '516 Tiger Blvd, Bentonville, AR 72712',
    featuredDollars: featured.dollars,
    featuredLabel: featured.label,
    days: DAY_ORDER.map(({ key, label }) => ({
      label,
      rateDollars: TIGER_BLVD_WEEK_RATES_DOLLARS[key],
      weekday: key,
    })),
    summary:
      `Suggested mid-market rates for a 3BR near downtown trails — tonight (${tonightKey}) $${TIGER_BLVD_WEEK_RATES_DOLLARS[tonightKey]}. ` +
      'Anchored between AirDNA Bentonville ADR ~$185 and AirROI median ~$198 / avg ~$232.',
    caption: 'Bentonville 3BR comps · AirDNA/AirROI public market data · On this device',
    sources: BENTONVILLE_MARKET_COMPS,
  };
}

export function formatWholeDollars(amount: number): string {
  return `$${Math.round(amount)}`;
}
