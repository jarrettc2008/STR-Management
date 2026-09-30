# Reservations, actual guest counts and verified links

## Status

This feature extends the existing authenticated SQLite API and Expo Router app. Home links to `/reservations`, which contains a monthly calendar, selectable reservations, guest contact/profile details, count editing, source history, monthly Occupancy Stay analytics, and operational planning inputs. No sample bookings are inserted into the user's database.

Airbnb/Vrbo remain unconnected. No credentials or live integration were present in this project. This implementation supplies an authorized, normalized import boundary for a future supported connector; it does not claim to pull platform data yet. There are no social-network searches, requests, scraping, identity guessing, or demographic inference anywhere in the feature. Opening an external profile happens only when the user selects the saved link.

## Import contract

`POST /api/reservations/import`, using the existing owner bearer session, accepts one complete source snapshot. Connector implementations must use a stable connection ID that identifies the source account, a stable reservation ID, and an actual source update timestamp. An example shape (documentation only):

```json
{
  "source": "Airbnb",
  "connectionId": "stable-owner-connection",
  "externalId": "platform-reservation-id",
  "propertyId": "tiger-blvd-516",
  "sourceUpdatedAt": "2026-09-01T12:00:00Z",
  "guest": { "externalId": "platform-guest-id", "displayName": "Guest name" },
  "checkIn": "2026-09-10",
  "checkOut": "2026-09-14",
  "status": "confirmed",
  "counts": { "adults": 2, "children": 2, "infants": 0, "pets": 1, "totalHumanGuests": 4 },
  "rawGuestCounts": { "adults": 2, "children": 2, "infants": 0, "pets": 1, "totalGuests": 4 },
  "stayRevenueCents": 124500,
  "currency": "USD",
  "bookingUrl": null,
  "cleaningRequired": true,
  "hotTubService": null
}
```

Only pass email/phone in `guest` when legitimately supplied by the source. Never derive them. Missing counts normalize to `null`, not zero. Preserve original field names, values and types in `rawGuestCounts`; accepted raw snapshots are also stored immutably in `reservation_imports`. The example's zero infants is an explicitly supplied value, not a fallback.

`totalHumanGuests` must mean all humans including infants and excluding pets. **Do not map an ambiguous platform `totalGuests` field blindly.** The future connector must establish its documented semantics. If a platform total excludes infants, include them only when their actual count is supplied; otherwise keep the human total unknown and preserve the original total in `rawGuestCounts`. iCal feeds or integrations that omit guest fields leave them unknown. A sum is calculated only when adults, children and infants are all known. No missing category is inferred by subtracting from a total.

Repeat imports upsert the same reservation. Identical updates are idempotent, stale updates are rejected, and different content at the same source timestamp requires correction rather than silently replacing data. Imports do not touch manual count overrides or verified profile associations. The source snapshot is a full replacement: omitted fields become unknown on a newer snapshot.

## Counts and manual changes

`PUT /api/reservations/:id/counts` accepts a complete replacement override object. Omit a key to restore source behavior; set a key to `null` to explicitly mark it unknown; set a nonnegative integer for a manual value. Each change is recorded in `reservation_edits`. Source snapshots never change when users edit counts.

An explicit manual human total wins. Otherwise, if a human category has a manual override, the total is recalculated only from a complete effective breakdown. This avoids silently keeping a stale source total after a category edit. If no category is overridden, an explicitly supplied source human total wins; otherwise the complete source breakdown is summed. Discrepancies between a total and a complete breakdown are shown for review; the explicit total is used for guest-nights. Pets never contribute to human totals. The detail screen labels manual values and displays original source values alongside them.

## Guest matching and profile links

Guests are owned by the signed-in user. Reuse requires the exact same `(user, source, connection, externalGuestId)` tuple. Names, email addresses, phone numbers, and cross-platform similarities do not cause automatic merging. Without a stable guest ID, only the unchanged guest on that exact reservation is retained between syncs; separate reservations get separate guest records. A changed primary guest without a stable ID gets a new record, avoiding transfer of an old verified profile.

The contact icon opens contact details and the profile editor. `PUT /api/reservations/:id/profile` accepts `profileUrl`, `profileSource`, `profileVerifiedManually` and `notes`. Nonempty URLs require explicit manual verification and an HTTPS URL without embedded credentials. The backend records `profile_added_at`, maintains a profile-edit audit, and preserves the original added timestamp when the URL is unchanged. Clearing the URL removes its active association. Because the profile belongs to the Guest, verified links are shared across reservations matched by stable identity. Source sync never populates or verifies a profile URL.

Only verified nonempty URLs produce a View Verified Profile action. Web opens a new tab with `noopener,noreferrer`; native delegates to the operating system's browser/link handler. The server never fetches these URLs. No profile-derived age, gender, relationships, occupation, location or other attributes are stored.

## Monthly analytics and operations

`GET /api/reservations/analytics?month=2026-09&propertyId=...` and the UI use the same `monthlyAnalytics` function. Calendars support 1900–2199. Dates are property-local calendar dates; UTC date arithmetic avoids daylight-saving hour errors.

- Cancelled bookings are excluded.
- Checkout is exclusive. Human guest-nights multiply effective human headcount by nights actually within the selected month.
- Monthly guest/category counts sum each overlapping reservation's party once. These are guest-stays, not distinct individuals. A cross-month stay contributes to both months' party counts, with its nights split correctly.
- Unknown counts are excluded from known subtotals and reported through unknown-stay/unknown-night coverage. Average party size uses only reservations with a known human total and shows its denominator.
- Occupied property-nights are deduplicated per property/date. No occupancy percentage is invented without an availability/block calendar.
- Turnovers and known cleaning/hot-tub requirements are counted in the checkout month. Unknown service flags remain unknown.
- Supply and utility planning uses actual known guest-nights with unknown coverage. Cleaning workload uses actual turnover counts and service flags. No consumption quantities, utility costs, or cleaning labor durations are fabricated; those forecasts require separately supplied usage rates.

Other endpoints: `GET /api/reservations` lists authorized bookings; `GET /api/reservations/:id` includes original import and manual count history. Every endpoint checks ownership and current property access on the server, including profile changes, import and analytics.

## Storage and files

Migration `002-reservations.sql` adds guests, reservations, reservation_imports, reservation_edits and guest_profile_edits, using the existing users/properties/access tables. Existing Work Log records are retained. Reservation source and override data use JSON within SQLite to preserve nulls, exact raw fields and evolving connector schemas; stable identity/ownership fields are indexed columns. Existing Work Log database backup instructions apply.

New files: `src/reservations/domain.ts`, `ReservationPage.tsx`, `ReservationDetails.tsx`, `ReservationWidget.tsx`, `external.ts`, `external.web.ts`; `src/app/reservations.tsx`; `server/reservations.mjs`; migration 002; `tests/reservations.test.mjs`. Updated: dashboard, shared authenticated provider, server routing and migration runner.

Validation includes the 16 guest-night example, infants/pets, unknown versus zero, manual override retention, original snapshot history, stale synchronization, month splitting/DST/cancellation, repeat-guest identity rules, manual verification/URL safety, and unauthorized import/read/edit/profile/analytics access. Tests run in isolated databases, not the user's reservation database.

## Home occupancy calendar

The former occupancy placeholder now displays a full month grid on the home dashboard, with previous/next month and Today controls. Stay bars cover check-in through the last occupied night, split across calendar weeks, and stack when bookings overlap. Airbnb, Vrbo and other sources use distinct colors. Select a day for arrivals/departures/overnight stays, or select a bar for reservation details. The calendar uses the existing property and authorized reservations; no fixture data is inserted. Blank dates are not claimed to be available because channel blocks have not been imported. Month navigation is independent of the financial overview period selector.


The home Occupancy card is now compact and opens the larger calendar at /occupancy when selected. The calendar page includes a Back to overview action and retains month navigation, stay bars, and reservation details.


Calendar stay bars and selected-day rows now show the effective human guest count beside the guest name. The detail person icon opens a stored, manually verified external profile directly; without one it opens the profile editor. A separate contact/edit action always remains available. Demo mode uses clearly labeled synthetic party sizes and opens only the Facebook homepage, never an invented personal profile association.

